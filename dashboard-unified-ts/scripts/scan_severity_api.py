"""Call enhanced-facial-analysis severity API from 3D scan photo sets."""

from __future__ import annotations

import base64
import json
import os
from typing import Any

SEVERITY_PREDICT_URL = os.getenv(
    "SEVERITY_PREDICT_URL",
    os.getenv(
        "GCP_SEVERITY_PREDICT_URL",
        os.getenv(
            "MODAL_PREDICT_URL",
            "https://patient-analysis-service-rm2sqmm74q-uc.a.run.app/predict",
        ),
    ),
)
DEFAULT_SCHEMA_VERSION = int(os.getenv("SEVERITY_SCHEMA_VERSION", "4"))
DEFAULT_AGE = int(os.getenv("SEVERITY_DEFAULT_AGE", "40"))


def _pick_photo(photos: dict[str, bytes], *candidates: str) -> bytes | None:
    for candidate in candidates:
        if candidate in photos:
            return photos[candidate]
    for key, data in photos.items():
        base = key.split("_", 1)[0]
        if base in candidates:
            return data
    return None


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _level_from_norm(n: float) -> str:
    if n >= 0.75:
        return "severe"
    if n >= 0.6:
        return "moderate-severe"
    if n >= 0.45:
        return "moderate"
    if n >= 0.3:
        return "mild-moderate"
    if n >= 0.15:
        return "mild"
    return "minimal"


def build_legacy_document(api: dict[str, Any], submission_id: str) -> dict[str, Any]:
    main_by = {p["issue"]: p for p in api.get("main_predictions") or []}
    sev_by = {p["issue"]: p for p in api.get("severity_predictions") or []}
    issues: dict[str, Any] = {}
    for name in sorted(set(main_by) | set(sev_by)):
        main = main_by.get(name, {})
        sev = sev_by.get(name, {})
        prob = float(main.get("confidence", 0))
        norm = max(0.0, min(1.0, float(sev.get("severity_score", prob))))
        predicted = prob >= 0.5 or norm >= 0.25
        issues[name] = {
            "predicted": predicted,
            "probability": round(prob, 4),
            "severity": max(1, min(5, round(norm * 4) + 1)) if predicted else 0,
            "severity_normalized_0_1": round(norm, 4),
            "severity_level": sev.get("severity_level") or _level_from_norm(norm),
            "source": "enhanced-facial-analysis-api",
        }
    return {
        "schema_version": DEFAULT_SCHEMA_VERSION,
        "detector_type": "multi_region",
        "submission_id": submission_id,
        "input_views": ["front", "left_90", "right_90", "left_45", "right_45"],
        "metadata": api.get("metadata", {}),
        "issues": issues,
    }


def normalize_severity_response(
    api: dict[str, Any],
    submission_id: str,
) -> dict[str, Any] | None:
    if not api.get("success"):
        return None
    if isinstance(api.get("issues"), dict) and api.get("issues"):
        doc = dict(api)
        doc["submission_id"] = submission_id
        doc.setdefault("schema_version", DEFAULT_SCHEMA_VERSION)
        doc.setdefault(
            "input_views",
            ["front", "left_90", "right_90", "left_45", "right_45"],
        )
        doc.pop("success", None)
        return doc
    return build_legacy_document(api, submission_id)


def build_severity_request_payload(
    photos: dict[str, bytes],
    *,
    age: int | None = None,
) -> dict[str, Any] | None:
    front = _pick_photo(photos, "front")
    if not front:
        return None

    left_90 = _pick_photo(photos, "left90", "left_90")
    right_90 = _pick_photo(photos, "right90", "right_90")
    left_45 = _pick_photo(photos, "left45", "left_45")
    right_45 = _pick_photo(photos, "right45", "right_45")
    side = _pick_photo(photos, "side") or left_90 or right_90

    payload: dict[str, Any] = {
        "front_image_base64": _b64(front),
        "age": age if age is not None and age > 0 else DEFAULT_AGE,
        "include_severity": True,
    }
    if side:
        payload["side_image_base64"] = _b64(side)
    if left_90:
        payload["left_90_image_base64"] = _b64(left_90)
    if right_90:
        payload["right_90_image_base64"] = _b64(right_90)
    if left_45:
        payload["left_45_image_base64"] = _b64(left_45)
    if right_45:
        payload["right_45_image_base64"] = _b64(right_45)
    return payload


def fetch_severity_scores_from_photos(
    photos: dict[str, bytes],
    *,
    age: int | None = None,
    submission_id: str = "scan",
    timeout: float = 180.0,
) -> dict[str, Any] | None:
    payload = build_severity_request_payload(photos, age=age)
    if not payload:
        print("[severity] No front photo — skipping severity API")
        return None

    try:
        import httpx

        with httpx.Client(timeout=timeout) as client:
            response = client.post(SEVERITY_PREDICT_URL, json=payload)
            if response.status_code == 429:
                print(f"[severity] Rate limited (429) by {SEVERITY_PREDICT_URL} — skipping severity")
                return None
            response.raise_for_status()
            ct = response.headers.get("content-type", "")
            if "json" not in ct:
                print(f"[severity] Non-JSON response ({ct}): {response.text[:200]}")
                return None
            api = response.json()
    except Exception as exc:
        print(f"[severity] API call failed: {exc}")
        return None

    doc = normalize_severity_response(api, submission_id)
    if not doc:
        print(f"[severity] API returned no severity document: {api}")
        return None

    predicted = [
        name
        for name, issue in (doc.get("issues") or {}).items()
        if isinstance(issue, dict) and issue.get("predicted")
    ]
    print(
        f"[severity] Got {len(predicted)} predicted issues for submission {submission_id}"
    )
    return doc


def severity_document_json(severity_doc: dict[str, Any]) -> str:
    return json.dumps(severity_doc, ensure_ascii=False)
