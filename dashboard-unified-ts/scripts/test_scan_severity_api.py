#!/usr/bin/env python3
from __future__ import annotations

import base64
import unittest

from scan_severity_api import (
    build_legacy_document,
    build_severity_request_payload,
    normalize_severity_response,
)


class ScanSeverityApiTest(unittest.TestCase):
    def test_build_payload_from_scan_photo_keys(self) -> None:
        payload = build_severity_request_payload(
            {
                "front": b"front",
                "left90": b"left90",
                "right90": b"right90",
                "left45": b"left45",
                "right45": b"right45",
            },
            age=52,
        )
        assert payload is not None
        self.assertEqual(payload["age"], 52)
        self.assertTrue(payload["include_severity"])
        self.assertEqual(base64.b64decode(payload["front_image_base64"]), b"front")
        self.assertIn("left_90_image_base64", payload)

    def test_normalize_legacy_response(self) -> None:
        doc = normalize_severity_response(
            {
                "success": True,
                "main_predictions": [
                    {"issue": "Dark Spots", "confidence": 0.82},
                ],
                "severity_predictions": [
                    {
                        "issue": "Dark Spots",
                        "severity_score": 0.61,
                        "severity_level": "moderate",
                    },
                ],
            },
            "scan-test",
        )
        assert doc is not None
        self.assertEqual(doc["submission_id"], "scan-test")
        self.assertTrue(doc["issues"]["Dark Spots"]["predicted"])

    def test_build_legacy_document(self) -> None:
        doc = build_legacy_document(
            {
                "main_predictions": [{"issue": "Wrinkles", "confidence": 0.7}],
                "severity_predictions": [{"issue": "Wrinkles", "severity_score": 0.5}],
            },
            "legacy-scan",
        )
        self.assertTrue(doc["issues"]["Wrinkles"]["predicted"])
        self.assertEqual(doc["submission_id"], "legacy-scan")


if __name__ == "__main__":
    raise SystemExit(unittest.main())
