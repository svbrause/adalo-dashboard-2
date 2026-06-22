"""Create in-clinic scan rows in Airtable Form Submissions with photo attachments."""

from __future__ import annotations

import os
import urllib.parse
from datetime import datetime, timezone
from typing import Any


def _airtable_api_token() -> str:
    """Accept both the python (AIRTABLE_API_TOKEN) and Node (AIRTABLE_API_KEY) names."""
    return (
        os.environ.get("AIRTABLE_API_TOKEN", "").strip()
        or os.environ.get("AIRTABLE_API_KEY", "").strip()
    )


def _form_table_name() -> str:
    return os.environ.get("AIRTABLE_FORM_SUBMISSIONS_TABLE", "Form Submissions").strip()


def _form_field(name: str, default: str) -> str:
    return os.environ.get(name, default).strip() or default


FORM_FIELD_PROVIDER = "AIRTABLE_FORM_FIELD_PROVIDER"
FORM_FIELD_NAME = "AIRTABLE_FORM_FIELD_NAME"
FORM_FIELD_EMAIL = "AIRTABLE_FORM_FIELD_EMAIL"
FORM_FIELD_PHONE = "AIRTABLE_FORM_FIELD_PHONE"
FORM_FIELD_FRONT_PHOTO = "AIRTABLE_FORM_FIELD_FRONT_PHOTO"
FORM_FIELD_SIDE_PHOTO = "AIRTABLE_FORM_FIELD_SIDE_PHOTO"
FORM_FIELD_LEFT_SIDE_PHOTO = "AIRTABLE_FORM_FIELD_LEFT_SIDE_PHOTO"
FORM_FIELD_AREAS = "AIRTABLE_FORM_FIELD_AREAS"
FORM_FIELD_REGIONS = "AIRTABLE_FORM_FIELD_REGIONS"
FORM_FIELD_SKIN = "AIRTABLE_FORM_FIELD_SKIN"
FORM_FIELD_WHAT_IMPROVE = "AIRTABLE_FORM_FIELD_WHAT_IMPROVE"
FORM_FIELD_SOURCE = "AIRTABLE_FORM_FIELD_SOURCE"
FORM_FIELD_PATIENT_LINK = "AIRTABLE_FORM_FIELD_PATIENT_LINK"
FORM_FIELD_SUBMISSION_ID = "AIRTABLE_FORM_FIELD_SUBMISSION_ID"
PATIENTS_TABLE_ENV = "AIRTABLE_PATIENTS_TABLE"
PATIENT_EMAIL_FIELD_ENV = "AIRTABLE_PATIENT_EMAIL_FIELD"
PATIENT_NAME_FIELD_ENV = "AIRTABLE_PATIENT_NAME_FIELD"
PATIENT_PROVIDER_FIELD_ENV = "AIRTABLE_PATIENT_FIELD_PROVIDERS"
PATIENT_FRONT_PHOTO_FIELD_ENV = "AIRTABLE_PATIENT_FIELD_FRONT_PHOTO"
PATIENT_PHONE_FIELD_ENV = "AIRTABLE_PATIENT_FIELD_PHONE"
PATIENT_SOURCE_FIELD_ENV = "AIRTABLE_PATIENT_FIELD_SOURCE"


FACE_REGION_LABELS: dict[str, str] = {
    "forehead-eyebrows": "Forehead and eyebrows",
    "eyes": "Eyes",
    "cheeks": "Cheeks",
    "lips": "Lips",
    "face-neck-aging": "Face and neck aging",
    "earlobes": "Earlobes",
    "jawline-chin": "Jawline/chin",
    "other": "Other",
}

SKIN_COMPLAINT_LABELS: dict[str, str] = {
    "acne": "Acne",
    "wrinkles": "Wrinkles",
    "pigment": "Pigment",
    "texture": "Texture",
    "sun-damage": "Sun damage",
    "thin": "Thin",
    "thick": "Thick",
    "oily": "Oily",
    "dry": "Dry",
    "redness": "Redness",
    "other": "Other",
}

WHAT_AREA_LABELS: dict[str, str] = {
    "face": "Face",
    "skin": "Skin",
    "wellness": "Wellness",
    "other": "Other",
}


def _airtable_configured() -> bool:
    return bool(
        _airtable_api_token()
        and os.environ.get("AIRTABLE_BASE_ID", "").strip()
    )


def _airtable_headers(api_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }


def _airtable_string_literal(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _attachment(url: str, filename: str) -> dict[str, str]:
    return {"url": url, "filename": filename}


def find_patient_record_by_email(email: str) -> dict[str, str] | None:
    """Return the first Patients record whose normalized email exactly matches."""
    email_norm = str(email or "").strip().lower()
    if "@" not in email_norm or "." not in email_norm:
        return None
    if not _airtable_configured():
        return None

    api_token = _airtable_api_token()
    base_id = os.environ["AIRTABLE_BASE_ID"].strip()
    table_name = os.environ.get(PATIENTS_TABLE_ENV, "Patients").strip() or "Patients"
    email_field = os.environ.get(PATIENT_EMAIL_FIELD_ENV, "Email").strip() or "Email"
    name_field = os.environ.get(PATIENT_NAME_FIELD_ENV, "Name").strip() or "Name"

    import httpx

    encoded_table = urllib.parse.quote(table_name, safe="")
    formula = f"LOWER({{{email_field}}}) = {_airtable_string_literal(email_norm)}"
    query = urllib.parse.urlencode(
        [
            ("filterByFormula", formula),
            ("pageSize", "2"),
            ("fields[]", email_field),
            ("fields[]", name_field),
        ]
    )
    url = f"https://api.airtable.com/v0/{base_id}/{encoded_table}?{query}"
    response = httpx.get(
        url,
        headers=_airtable_headers(api_token),
        timeout=30,
        follow_redirects=True,
    )
    response.raise_for_status()
    records = response.json().get("records") or []
    if not records:
        return None
    if len(records) > 1:
        print(f"[clinic-scan] Multiple Patients rows matched email {email_norm}; using the first")

    record = records[0]
    fields = record.get("fields") or {}
    record_id = str(record.get("id") or "")
    if not record_id:
        return None
    return {
        "id": record_id,
        "tableName": table_name,
        "email": str(fields.get(email_field) or email_norm),
        "name": str(fields.get(name_field) or ""),
    }


def _field_has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, list):
        return len(value) > 0
    if isinstance(value, str):
        return bool(value.strip())
    return True


def _record_id_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x or "").strip()]
    text = str(value or "").strip()
    return [text] if text else []


def find_patient_record_for_clinic_scan(
    email: str,
    provider_id: str | None = None,
) -> dict[str, str] | None:
    """Prefer the fresh automation-created Patients row for an in-clinic scan."""
    email_norm = str(email or "").strip().lower()
    if "@" not in email_norm or "." not in email_norm:
        return None
    if not _airtable_configured():
        return None

    api_token = _airtable_api_token()
    base_id = os.environ["AIRTABLE_BASE_ID"].strip()
    table_name = os.environ.get(PATIENTS_TABLE_ENV, "Patients").strip() or "Patients"
    email_field = os.environ.get(PATIENT_EMAIL_FIELD_ENV, "Email").strip() or "Email"
    name_field = os.environ.get(PATIENT_NAME_FIELD_ENV, "Name").strip() or "Name"

    import httpx

    encoded_table = urllib.parse.quote(table_name, safe="")
    formula = f"LOWER(TRIM({{{email_field}}})) = {_airtable_string_literal(email_norm)}"
    query_items: list[tuple[str, str]] = [
        ("filterByFormula", formula),
        ("pageSize", "25"),
        ("maxRecords", "25"),
    ]
    query = urllib.parse.urlencode(query_items)
    url = f"https://api.airtable.com/v0/{base_id}/{encoded_table}?{query}"
    response = httpx.get(
        url,
        headers=_airtable_headers(api_token),
        timeout=30,
        follow_redirects=True,
    )
    response.raise_for_status()
    records = response.json().get("records") or []
    if not records:
        return None

    provider_id = str(provider_id or "").strip()

    def score(record: dict[str, Any]) -> tuple[float, float]:
        record_fields = record.get("fields") or {}
        provider_ids = set(_record_id_list(record_fields.get("Record ID (from Providers)")))
        provider_ids.update(_record_id_list(record_fields.get("Providers")))
        provider_match = not provider_id or provider_id in provider_ids
        pending = "pending" in str(record_fields.get("Pending/Opened") or "").lower()
        source = str(record_fields.get("Source") or record_fields.get("source") or "").lower()
        has_outputs = (
            _field_has_value(record_fields.get("Severity Scores (from Analyses)"))
            or _field_has_value(record_fields.get("Aura Manifest URL"))
            or _field_has_value(record_fields.get("Aura GCS Prefix"))
        )
        created = record.get("createdTime") or ""
        try:
            created_ts = datetime.fromisoformat(str(created).replace("Z", "+00:00")).timestamp()
        except Exception:
            created_ts = 0.0
        value = 0.0
        if provider_match:
            value += 100
        if pending:
            value += 40
        if "clinic" in source:
            value += 20
        if not has_outputs:
            value += 15
        if _field_has_value(record_fields.get("Front Photo")):
            value += 5
        return value, created_ts

    records.sort(key=score, reverse=True)
    record = records[0]
    record_id = str(record.get("id") or "")
    if not record_id:
        return None
    record_fields = record.get("fields") or {}
    return {
        "id": record_id,
        "tableName": table_name,
        "email": str(record_fields.get(email_field) or email_norm),
        "name": str(record_fields.get(name_field) or ""),
    }


def patch_patient_record_from_clinic_scan(
    record_id: str,
    *,
    provider_id: str | None,
    first_name: str,
    last_name: str,
    email: str,
    phone: str,
    photo_attachments: dict[str, list[dict[str, str]]] | None = None,
) -> bool:
    """Best-effort enrichment of the fresh Patients row with direct list-view fields."""
    if not record_id or not _airtable_configured():
        return False

    api_token = _airtable_api_token()
    base_id = os.environ["AIRTABLE_BASE_ID"].strip()
    table_name = os.environ.get(PATIENTS_TABLE_ENV, "Patients").strip() or "Patients"
    fields: dict[str, Any] = {}
    full_name = " ".join(x for x in [first_name.strip(), last_name.strip()] if x).strip()
    name_field = os.environ.get(PATIENT_NAME_FIELD_ENV, "Name").strip() or "Name"
    email_field = os.environ.get(PATIENT_EMAIL_FIELD_ENV, "Email").strip() or "Email"
    fields[name_field] = full_name or email.strip().lower() or "In-clinic scan client"
    if email.strip():
        fields[email_field] = email.strip().lower()
    phone_field = os.environ.get(PATIENT_PHONE_FIELD_ENV, "").strip()
    if phone.strip() and phone_field:
        fields[phone_field] = phone.strip()
    provider_field = os.environ.get(PATIENT_PROVIDER_FIELD_ENV, "Providers").strip()
    if provider_id and provider_field:
        fields[provider_field] = [provider_id]
    source_field = os.environ.get(PATIENT_SOURCE_FIELD_ENV, "").strip()
    if source_field:
        fields[source_field] = os.environ.get("AIRTABLE_CLINIC_SCAN_SOURCE", "In-clinic scan").strip()
    if photo_attachments and photo_attachments.get("front"):
        front_field = os.environ.get(PATIENT_FRONT_PHOTO_FIELD_ENV, "Front Photo").strip() or "Front Photo"
        fields[front_field] = photo_attachments["front"]

    import httpx

    encoded_table = urllib.parse.quote(table_name, safe="")
    url = f"https://api.airtable.com/v0/{base_id}/{encoded_table}/{record_id}"
    response = httpx.patch(
        url,
        json={"fields": fields, "typecast": True},
        headers=_airtable_headers(api_token),
        timeout=30,
        follow_redirects=True,
    )
    if response.status_code >= 400:
        print(f"[clinic-scan] Patient enrichment patch failed: {response.text}")
        return False
    return True


def link_form_submission_to_patient(
    form_submission_id: str,
    patient_record_id: str,
) -> bool:
    if not form_submission_id or not patient_record_id or not _airtable_configured():
        return False

    api_token = _airtable_api_token()
    base_id = os.environ["AIRTABLE_BASE_ID"].strip()
    table_name = _form_table_name()
    patient_link_field = os.environ.get(FORM_FIELD_PATIENT_LINK, "Patients").strip()
    if not patient_link_field:
        return False

    import httpx

    encoded_table = urllib.parse.quote(table_name, safe="")
    url = f"https://api.airtable.com/v0/{base_id}/{encoded_table}/{form_submission_id}"
    response = httpx.patch(
        url,
        json={"fields": {patient_link_field: [patient_record_id]}, "typecast": True},
        headers=_airtable_headers(api_token),
        timeout=30,
        follow_redirects=True,
    )
    if response.status_code >= 400:
        print(f"[clinic-scan] Form Submission patient link patch failed: {response.text}")
        return False
    return True


def build_form_submission_fields(
    *,
    provider_name: str,
    first_name: str,
    last_name: str,
    email: str,
    phone: str,
    what_areas: list[str] | None = None,
    face_regions: list[str] | None = None,
    skin_complaints: list[str] | None = None,
    photo_attachments: dict[str, list[dict[str, str]]] | None = None,
    patient_record_id: str | None = None,
    submission_id: str | None = None,
) -> dict[str, Any]:
    """Map in-clinic intake payload to Airtable Form Submissions fields."""
    fields: dict[str, Any] = {}

    provider_field = _form_field(FORM_FIELD_PROVIDER, "Provider Name (from Jotform)")
    if provider_name.strip():
        fields[provider_field] = provider_name.strip()

    name_field = _form_field(FORM_FIELD_NAME, "Name")
    full_name = " ".join(x for x in [first_name.strip(), last_name.strip()] if x).strip()
    if full_name:
        fields[name_field] = full_name

    email_field = _form_field(FORM_FIELD_EMAIL, "Email Address")
    if email.strip():
        fields[email_field] = email.strip().lower()

    phone_field = _form_field(FORM_FIELD_PHONE, "Phone Number")
    if phone.strip():
        fields[phone_field] = phone.strip()

    areas = [
        WHAT_AREA_LABELS.get(x, x.replace("-", " ").title())
        for x in (what_areas or [])
        if str(x).strip()
    ]
    if areas:
        areas_field = _form_field(FORM_FIELD_AREAS, "Areas of Interest")
        fields[areas_field] = ", ".join(dict.fromkeys(areas))
        improve_field = _form_field(FORM_FIELD_WHAT_IMPROVE, "What would you like to improve?")
        fields[improve_field] = ", ".join(dict.fromkeys(areas))

    regions = [
        FACE_REGION_LABELS.get(x, x.replace("-", " ").title())
        for x in (face_regions or [])
        if str(x).strip()
    ]
    if regions:
        regions_field = _form_field(
            FORM_FIELD_REGIONS,
            "Which regions of your face do you want to improve?",
        )
        fields[regions_field] = ", ".join(dict.fromkeys(regions))

    complaints = [
        SKIN_COMPLAINT_LABELS.get(x, x.replace("-", " ").title())
        for x in (skin_complaints or [])
        if str(x).strip()
    ]
    if complaints:
        skin_field = _form_field(FORM_FIELD_SKIN, "Do you have any skin complaints?")
        fields[skin_field] = ", ".join(dict.fromkeys(complaints))

    source_field = _form_field(FORM_FIELD_SOURCE, "Source")
    fields[source_field] = os.environ.get("AIRTABLE_CLINIC_SCAN_SOURCE", "In-clinic scan").strip()

    submission_id_field = _form_field(FORM_FIELD_SUBMISSION_ID, "Submission ID")
    if str(submission_id or "").strip():
        fields[submission_id_field] = str(submission_id).strip()

    if photo_attachments:
        front_field = _form_field(FORM_FIELD_FRONT_PHOTO, "Front Photo")
        side_field = _form_field(FORM_FIELD_SIDE_PHOTO, "Side Photo")
        left_field = _form_field(FORM_FIELD_LEFT_SIDE_PHOTO, "Left Side Photo")
        if photo_attachments.get("front"):
            fields[front_field] = photo_attachments["front"]
        if photo_attachments.get("side"):
            fields[side_field] = photo_attachments["side"]
        if photo_attachments.get("left_side"):
            fields[left_field] = photo_attachments["left_side"]

    patient_link_field = os.environ.get(FORM_FIELD_PATIENT_LINK, "Patients").strip()
    if patient_record_id and patient_link_field:
        fields[patient_link_field] = [patient_record_id]

    return fields


def create_form_submission_record(fields: dict[str, Any]) -> str | None:
    """Create a Form Submissions row; returns Airtable record id or None."""
    if not _airtable_configured() or not fields:
        return None

    api_token = _airtable_api_token()
    base_id = os.environ["AIRTABLE_BASE_ID"].strip()
    table_name = _form_table_name()

    import httpx

    encoded_table = urllib.parse.quote(table_name, safe="")
    url = f"https://api.airtable.com/v0/{base_id}/{encoded_table}"
    response = httpx.post(
        url,
        json={"fields": fields},
        headers={
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        },
        timeout=60,
        follow_redirects=True,
    )
    response.raise_for_status()
    data = response.json()
    record_id = data.get("id")
    print(
        f"[clinic-scan] Created Form Submissions record {record_id} "
        f"at {datetime.now(timezone.utc).isoformat()}"
    )
    return str(record_id) if record_id else None
