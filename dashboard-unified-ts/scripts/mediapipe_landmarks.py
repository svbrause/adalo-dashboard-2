"""MediaPipe Face Landmarker (Tasks API) — shared loader."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def face_landmarker_model() -> Path:
    cache = ROOT / ".cache" / "face_landmarker.task"
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        url = (
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
            "face_landmarker/float16/1/face_landmarker.task"
        )
        subprocess.run(["curl", "-fsSL", url, "-o", str(cache)], check=True, timeout=180)
    return cache


def detect_face_landmarks(rgb: np.ndarray) -> list[Any] | None:
    """Return 478 normalized landmarks for the primary face, or None."""
    try:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision
    except ImportError:
        return None

    opts = vision.FaceLandmarkerOptions(
        base_options=mp_python.BaseOptions(
            model_asset_path=str(face_landmarker_model()),
            delegate=mp_python.BaseOptions.Delegate.CPU,
        ),
        running_mode=vision.RunningMode.IMAGE,
        num_faces=1,
    )
    landmarker = vision.FaceLandmarker.create_from_options(opts)
    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
    result = landmarker.detect(mp_img)
    landmarker.close()
    if not result.face_landmarks:
        return None
    return result.face_landmarks[0]
