# 3D scan + Aura skin pipeline

After Modal reconstructs a patient turntable, the scan server runs **`scripts/generate_patient_aura_assets.py`** to produce:

| Asset | Purpose |
|-------|---------|
| `{slug}-turntable-skin-gray.mp4` | Skin tab (clinical grayscale turntable) |
| `{slug}-turntable-pigmentation.mp4` | Pigmentation tab |
| `{slug}-{angle}-rembg.png` | Background-removed stills |
| `{slug}-{angle}-texture.png` | Grayscale skin plates |
| `{slug}-{angle}-pigmentation.png` | Brown pigment plates |
| `{slug}-aura-manifest.json` | URLs + `cvAnnotations` for the dashboard |

Files are written under `public/demo-3d/{slug}/`. When GCS is configured, they are uploaded to `gs://{bucket}/aura/{slug}/` and the job returns **`auraAssets`** with public URLs.

## Deploy to `ponce-patient-backend`

The dashboard calls **`https://ponce-patient-backend.vercel.app/api/scan/*`**. That service must include the same logic as this repo’s **`server.py`**:

1. Copy (or sync) into the backend repo:
   - `server.py` (scan routes + aura hook in `_run_modal_job`)
   - `scripts/generate_patient_aura_assets.py`
   - `scripts/generate-turntable-pigmentation-video.py`
   - `scripts/generate-aura-cv-assets.py`
   - `scripts/scan_aura_gcs.py`
2. Add to backend **`requirements.txt`**:
   ```
   opencv-python-headless>=4.8
   numpy>=1.24
   Pillow>=10.0
   ```
3. Set env vars (same as turntable save):
   - `GCS_TURNTABLE_BUCKET`
   - `GCS_SERVICE_ACCOUNT_JSON`
4. Redeploy the backend. **Vercel serverless** must allow long-running jobs (or run scan worker elsewhere); aura post-process adds ~1–3 minutes after Modal.

## Re-encode gray skin turntable (nose clip fix)

If patients already have a raw turntable but the gray `{slug}-turntable-skin-gray.mp4` clips the profile nose, re-run only the video pass (no new 3D scan):

```bash
python scripts/generate_patient_aura_assets.py \
  --slug allison-baum \
  --turntable public/demo-3d/allison-baum-turntable.mp4 \
  --videos-only
```

New scans pick up the fixed matte automatically after Modal/backend deploy.

## Local verification

```bash
pip install -r requirements.txt
python3 server.py
# In .env.local: VITE_SCAN_API_URL=http://localhost:8787
```

Regenerate aura assets for an existing turntable:

```bash
python3 scripts/generate_patient_aura_assets.py \
  --slug adela-ashraf \
  --turntable public/demo-3d/adela-ashraf-turntable.mp4 \
  --photo front=path/to/front.jpg \
  --photo left90=path/to/left.jpg \
  --photo right90=path/to/right.jpg
```

## Neck / white halo fix

`generate-turntable-pigmentation-video.py` now:

- Trims the subject mask below ~86% of face height (neck/chest)
- Composites clinical skin onto **pure black** outside the mask

Regenerate the patient scan (or re-run the script above) to pick up the fix.

## Dashboard behavior

- **Tanya Tan / Aura demo** — bundled videos + annotations (`clientUsesAuraScan`).
- **All other patients** — `auraAssets` from the job; no Tanya turntable fallback.
- If `textureVideoUrl` is missing (old scan), Skin tab uses the **color** turntable until you regenerate.
