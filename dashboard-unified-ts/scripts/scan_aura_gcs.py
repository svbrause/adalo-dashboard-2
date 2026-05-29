"""Upload patient Aura asset files to GCS and rewrite manifest URLs."""

from __future__ import annotations

import json
import mimetypes
import os
from pathlib import Path
from typing import Any


def upload_aura_manifest_to_gcs(
    slug: str,
    out_dir: Path,
    manifest: dict[str, Any],
) -> dict[str, Any] | None:
    """Upload all files under out_dir to GCS; return manifest with public URLs."""
    bucket_name = (
        os.environ.get("GCS_TURNTABLE_BUCKET", "").strip()
        or os.environ.get("GCS_BLUEPRINT_BUCKET", "").strip()
        or os.environ.get("GCS_SCAN_BUCKET", "").strip()
    )
    sa_json_str = os.environ.get("GCS_SERVICE_ACCOUNT_JSON", "").strip()
    if not bucket_name or not sa_json_str:
        return None

    try:
        from google.cloud import storage as gcs_storage  # type: ignore
        from google.oauth2 import service_account as gcs_sa  # type: ignore
    except ImportError:
        print("[aura-gcs] google-cloud-storage not installed")
        return None

    try:
        sa_info = json.loads(sa_json_str)
        creds = gcs_sa.Credentials.from_service_account_info(
            sa_info,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        client = gcs_storage.Client(credentials=creds, project=sa_info.get("project_id"))
        bucket = client.bucket(bucket_name)
        prefix = f"aura/{slug}"

        url_map: dict[str, str] = {}
        for path in sorted(out_dir.iterdir()):
            if not path.is_file():
                continue
            blob_name = f"{prefix}/{path.name}"
            content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            blob = bucket.blob(blob_name)
            blob.upload_from_filename(str(path), content_type=content_type)
            url_map[path.name] = f"https://storage.googleapis.com/{bucket_name}/{blob_name}"

        def rewrite(url: str | None) -> str | None:
            if not url:
                return url
            name = Path(url.split("?")[0]).name
            return url_map.get(name, url)

        out = dict(manifest)
        out["turntableVideoUrl"] = rewrite(manifest.get("turntableVideoUrl"))
        out["textureVideoUrl"] = rewrite(manifest.get("textureVideoUrl"))
        out["pigmentationVideoUrl"] = rewrite(manifest.get("pigmentationVideoUrl"))
        angles_out: dict[str, Any] = {}
        for angle, asset in (manifest.get("angles") or {}).items():
            if not isinstance(asset, dict):
                angles_out[angle] = asset
                continue
            angles_out[angle] = {
                **asset,
                "src": rewrite(asset.get("src")),
                "srcOriginal": rewrite(asset.get("srcOriginal")),
                "srcTexture": rewrite(asset.get("srcTexture")),
                "srcPigmentation": rewrite(asset.get("srcPigmentation")),
            }
        out["angles"] = angles_out
        print(f"[aura-gcs] Uploaded {len(url_map)} files for {slug}", flush=True)
        return out
    except Exception as exc:
        print(f"[aura-gcs] Upload failed for {slug}: {exc}", flush=True)
        return None
