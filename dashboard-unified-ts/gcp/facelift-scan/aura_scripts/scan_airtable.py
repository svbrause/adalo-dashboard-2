"""Airtable helpers for persisting 3D scan outputs.

Analyses rows are upserted by (patient, Submission ID) so the scan worker,
the backend save-video route, and the dashboard can all persist the same
job without creating duplicate rows. The Submission ID written here matches
the Submission ID stored on the originating Form Submissions row.
"""

from __future__ import annotations

import json
import os
import re
import urllib.parse
from typing import Any


def _airtable_headers(api_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }


def _airtable_creds() -> tuple[str, str] | None:
    # Accept both the python (AIRTABLE_API_TOKEN) and Node (AIRTABLE_API_KEY) names.
    api_token = (
        os.environ.get("AIRTABLE_API_TOKEN", "").strip()
        or os.environ.get("AIRTABLE_API_KEY", "").strip()
    )
    base_id = os.environ.get("AIRTABLE_BASE_ID", "").strip()
    if not api_token or not base_id:
        return None
    return api_token, base_id


def _table_url(base_id: str, table_name: str, record_id: str | None = None) -> str:
    encoded_table = urllib.parse.quote(table_name, safe="")
    url = f"https://api.airtable.com/v0/{base_id}/{encoded_table}"
    return f"{url}/{record_id}" if record_id else url


def _escape_formula_literal(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _rejected_field_name(response_body: dict[str, Any]) -> str | None:
    message = ""
    error = response_body.get("error")
    if isinstance(error, dict):
        message = str(error.get("message") or "")
    elif isinstance(error, str):
        message = str(response_body.get("message") or "")
    for pattern in (
        r'Unknown field name: "([^"]+)"',
        r'Field "([^"]+)" cannot accept a value',
        r'Cannot update field "([^"]+)"',
    ):
        match = re.search(pattern, message)
        if match:
            return match.group(1)
    return None


def _write_record_tolerant(
    *,
    api_token: str,
    base_id: str,
    table_name: str,
    fields: dict[str, Any],
    record_id: str | None = None,
    required_fields: set[str] | None = None,
) -> str | None:
    """POST/PATCH a record, dropping optional fields Airtable rejects.

    Returns the record id on success, None on failure.
    """
    import httpx

    remaining = dict(fields)
    required = required_fields or set()
    url = _table_url(base_id, table_name, record_id)
    method = "patch" if record_id else "post"

    for _ in range(max(len(remaining), 1) + 1):
        if not remaining:
            return None
        response = httpx.request(
            method,
            url,
            json={"fields": remaining, "typecast": True},
            headers=_airtable_headers(api_token),
            timeout=30,
            follow_redirects=True,
        )
        if response.is_success:
            data = response.json()
            return str(data.get("id") or record_id or "") or None

        body = response.json() if "json" in response.headers.get("content-type", "") else {}
        rejected = _rejected_field_name(body if isinstance(body, dict) else {})
        if rejected and rejected not in required and rejected in remaining:
            print(
                f"[server] Airtable {table_name} rejected optional field {rejected!r}; retrying without it"
            )
            remaining.pop(rejected)
            continue

        print(f"[server] Airtable {table_name} {method.upper()} failed: {response.text[:300]}")
        return None

    return None


def _patch_record_fields(
    *,
    api_token: str,
    base_id: str,
    table_name: str,
    record_id: str,
    fields: dict[str, Any],
) -> bool:
    import httpx

    response = httpx.patch(
        _table_url(base_id, table_name, record_id),
        json={"fields": fields},
        headers=_airtable_headers(api_token),
        timeout=20,
        follow_redirects=True,
    )
    response.raise_for_status()
    return True


def find_analysis_record_id(
    patient_record_id: str,
    submission_id: str,
) -> str | None:
    """Find an existing Analyses row for this patient + submission id."""
    creds = _airtable_creds()
    if not creds or not patient_record_id or not submission_id:
        return None
    api_token, base_id = creds

    analyses_table = os.environ.get("AIRTABLE_ANALYSES_TABLE", "Analyses").strip()
    patient_lookup_field = os.environ.get(
        "AIRTABLE_ANALYSIS_PATIENT_RECORD_LOOKUP_FIELD",
        "RECORD ID (from Patients)",
    ).strip()
    submission_field = os.environ.get(
        "AIRTABLE_ANALYSIS_SUBMISSION_ID_FIELD",
        "Submission ID",
    ).strip()

    formula = (
        f'AND(FIND("{_escape_formula_literal(patient_record_id)}", '
        f"ARRAYJOIN({{{patient_lookup_field}}})) > 0, "
        f'{{{submission_field}}}="{_escape_formula_literal(submission_id)}")'
    )

    import httpx

    try:
        response = httpx.get(
            _table_url(base_id, analyses_table),
            params={"filterByFormula": formula, "maxRecords": 1, "pageSize": 1},
            headers=_airtable_headers(api_token),
            timeout=20,
            follow_redirects=True,
        )
        response.raise_for_status()
        records = response.json().get("records") or []
        if records:
            return str(records[0].get("id") or "") or None
    except Exception as exc:
        print(f"[server] Analyses lookup by submission id failed: {exc}")
    return None


def write_severity_scores_to_airtable(
    record_id: str,
    table_name: str,
    severity_doc: dict[str, Any],
    submission_id: str | None = None,
    provider_id: str | None = None,
    patient_name: str | None = None,
    patient_email: str | None = None,
    video_url: str | None = None,
) -> bool:
    """Persist severity JSON on an Analyses row linked to the patient.

    Upserts by (patient, Submission ID): the scan worker and any later
    save-video calls converge on a single Analyses row.
    """
    creds = _airtable_creds()
    if not creds:
        print("[server] AIRTABLE_API_TOKEN or AIRTABLE_BASE_ID not set — skipping severity write")
        return False
    api_token, base_id = creds

    severity_json = json.dumps(severity_doc, ensure_ascii=False)

    # Optional direct patch of a writable patient field. Only attempted when
    # explicitly configured: the default "Severity Scores (from Analyses)"
    # patient field is a lookup and cannot be written.
    patient_field = os.environ.get("AIRTABLE_SEVERITY_FIELD", "").strip()
    if patient_field:
        try:
            _patch_record_fields(
                api_token=api_token,
                base_id=base_id,
                table_name=table_name,
                record_id=record_id,
                fields={patient_field: severity_json},
            )
            print(f"[server] Airtable record {record_id} updated with severity scores")
            return True
        except Exception as exc:
            print(f"[server] Direct severity field update failed ({patient_field}): {exc}")

    patients_table = os.environ.get("AIRTABLE_PATIENTS_TABLE", "Patients").strip()
    if table_name.strip() != patients_table:
        print(
            f"[server] Severity write skipped: Analyses rows link {patients_table}, got {table_name!r}"
        )
        return False

    analyses_table = os.environ.get("AIRTABLE_ANALYSES_TABLE", "Analyses").strip()
    severity_field = os.environ.get(
        "AIRTABLE_ANALYSIS_SEVERITY_FIELD",
        "Severity Scores",
    ).strip()
    patient_link_field = os.environ.get(
        "AIRTABLE_ANALYSIS_PATIENT_FIELD",
        "Patients",
    ).strip()
    submission_id_field = os.environ.get(
        "AIRTABLE_ANALYSIS_SUBMISSION_ID_FIELD",
        "Submission ID",
    ).strip()
    provider_field = os.environ.get(
        "AIRTABLE_ANALYSIS_PROVIDER_FIELD",
        "Provider",
    ).strip()
    patient_name_field = os.environ.get(
        "AIRTABLE_ANALYSIS_PATIENT_NAME_FIELD",
        "Patient Name",
    ).strip()
    patient_email_field = os.environ.get(
        "AIRTABLE_ANALYSIS_PATIENT_EMAIL_FIELD",
        "Patient Email",
    ).strip()
    animation_video_field = os.environ.get(
        "AIRTABLE_ANALYSIS_ANIMATION_VIDEO_FIELD",
        "Animation Video",
    ).strip()

    analysis_submission_id = (
        str(submission_id or "").strip()
        or str(severity_doc.get("submission_id") or "").strip()
    )

    fields: dict[str, Any] = {
        patient_link_field: [record_id],
        severity_field: severity_json,
    }
    if submission_id_field and analysis_submission_id:
        fields[submission_id_field] = analysis_submission_id
    if provider_field and str(provider_id or "").strip():
        fields[provider_field] = [str(provider_id).strip()]
    if patient_name_field and str(patient_name or "").strip():
        fields[patient_name_field] = str(patient_name).strip()
    if patient_email_field and str(patient_email or "").strip():
        fields[patient_email_field] = str(patient_email).strip()
    if animation_video_field and str(video_url or "").strip():
        fields[animation_video_field] = [{"url": str(video_url).strip()}]

    existing_id = (
        find_analysis_record_id(record_id, analysis_submission_id)
        if analysis_submission_id
        else None
    )

    saved_id = _write_record_tolerant(
        api_token=api_token,
        base_id=base_id,
        table_name=analyses_table,
        fields=fields,
        record_id=existing_id,
        required_fields={patient_link_field, severity_field},
    )
    if saved_id:
        action = "Updated" if existing_id else "Created"
        print(
            f"[server] {action} {analyses_table} record {saved_id} for patient {record_id} "
            f"(submission {analysis_submission_id or 'n/a'})"
        )
        return True
    return False


def update_airtable_scan_urls(
    record_id: str,
    table_name: str,
    video_url: str,
    aura_manifest_url: str | None = None,
    aura_gcs_prefix: str | None = None,
    severity_doc: dict[str, Any] | None = None,
    submission_id: str | None = None,
    provider_id: str | None = None,
    patient_name: str | None = None,
    patient_email: str | None = None,
) -> bool:
    """PATCH scan URL fields on an Airtable record."""
    creds = _airtable_creds()
    if not creds:
        print("[server] AIRTABLE_API_TOKEN or AIRTABLE_BASE_ID not set — skipping Airtable update")
        return False
    api_token, base_id = creds

    fields: dict[str, Any] = {"Turntable Video URL": video_url}
    if aura_manifest_url:
        fields["Aura Manifest URL"] = aura_manifest_url
    if aura_gcs_prefix:
        fields["Aura GCS Prefix"] = aura_gcs_prefix

    try:
        _patch_record_fields(
            api_token=api_token,
            base_id=base_id,
            table_name=table_name,
            record_id=record_id,
            fields=fields,
        )
        print(f"[server] Airtable record {record_id} updated with scan URLs")
    except Exception as exc:
        print(f"[server] Airtable update failed: {exc}")
        if not aura_manifest_url and not aura_gcs_prefix:
            return False
        try:
            _patch_record_fields(
                api_token=api_token,
                base_id=base_id,
                table_name=table_name,
                record_id=record_id,
                fields={"Turntable Video URL": video_url},
            )
            print(f"[server] Airtable record {record_id} updated with turntable URL only")
        except Exception as fallback_exc:
            print(f"[server] Airtable fallback update failed: {fallback_exc}")
            return False

    if severity_doc:
        write_severity_scores_to_airtable(
            record_id,
            table_name,
            severity_doc,
            submission_id=submission_id,
            provider_id=provider_id,
            patient_name=patient_name,
            patient_email=patient_email,
            video_url=video_url,
        )

    return True
