#!/usr/bin/env python3
"""
Fetch Tanya Tan demo severity scores from the deployed severity API.

Usage:
  python3 scripts/fetch-tanya-severity-modal.py

Environment overrides:
  MODAL_PREDICT_URL=https://...            # Modal / Cloud Run endpoint
  TANYA_SCHEMA_VERSION=4                   # schema tag for normalized fallback output

Writes src/debug/tanya-tan-severity-scores.json (consumed by adminDemoClients.ts).
"""

from __future__ import annotations

import os
import base64
import json
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
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
SCHEMA_VERSION = int(os.getenv("TANYA_SCHEMA_VERSION", "4"))
FRONT = ROOT / "src/assets/images/tan_front.JPG"
SIDE = ROOT / "src/assets/images/tan_90_left.JPG"
LEFT_90 = ROOT / "src/assets/images/tan_90_left.JPG"
RIGHT_90 = ROOT / "src/assets/images/tan_90_right.JPG"
LEFT_45 = ROOT / "src/assets/images/tan_45_left.JPG"
RIGHT_45 = ROOT / "src/assets/images/tan_45_right.JPG"
OUT = ROOT / "src/debug/tanya-tan-severity-scores.json"
AGE = 38


def _b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


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


def build_legacy_document(api: dict) -> dict:
    main_by = {p["issue"]: p for p in api.get("main_predictions") or []}
    sev_by = {p["issue"]: p for p in api.get("severity_predictions") or []}
    issues: dict = {}
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
        "schema_version": SCHEMA_VERSION,
        "detector_type": "multi_region",
        "submission_id": "admin-demo-tanya",
        "input_views": ["front", "left_90", "right_90", "left_45", "right_45"],
        "metadata": api.get("metadata", {}),
        "issues": issues,
    }


def main() -> int:
    for path in (FRONT, SIDE, LEFT_90, RIGHT_90, LEFT_45, RIGHT_45):
        if not path.is_file():
            print(f"Missing image: {path}", file=sys.stderr)
            return 1

    payload = {
        "front_image_base64": _b64(FRONT),
        "side_image_base64": _b64(SIDE),
        "left_90_image_base64": _b64(LEFT_90),
        "right_90_image_base64": _b64(RIGHT_90),
        "left_45_image_base64": _b64(LEFT_45),
        "right_45_image_base64": _b64(RIGHT_45),
        "age": AGE,
        "include_severity": True,
    }
    print(f"POST {SEVERITY_PREDICT_URL}")
    resp = requests.post(SEVERITY_PREDICT_URL, json=payload, timeout=180)
    resp.raise_for_status()
    api = resp.json()
    if not api.get("success"):
        print(f"API error: {api}", file=sys.stderr)
        return 1

    # Newer combined/v3 API already returns a full `issues` map + schema metadata.
    if isinstance(api.get("issues"), dict) and api.get("issues"):
        doc = dict(api)
        doc.setdefault("submission_id", "admin-demo-tanya")
        doc.setdefault("schema_version", SCHEMA_VERSION)
        doc.setdefault(
            "input_views", ["front", "left_90", "right_90", "left_45", "right_45"]
        )
        # `success` is transport metadata, not persisted in our per-client payload.
        doc.pop("success", None)
    else:
        # Legacy endpoint shape with split arrays.
        doc = build_legacy_document(api)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    predicted = [k for k, v in doc["issues"].items() if v.get("predicted")]
    print(f"Wrote {OUT.relative_to(ROOT)} ({len(predicted)} predicted issues)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
