# GCP FaceLift Scan API

Cloud Run GPU replacement for the Modal-backed scan API.

It keeps the dashboard contract:

- `POST /api/scan/submit`
- `GET /api/scan/status/{jobId}`
- `POST /submit`
- `GET /status?job_id=...`

## Deploy

```bash
cd gcp/facelift-scan
./deploy.sh
```

The deploy script builds the CUDA image with Cloud Build, creates/updates a Cloud Tasks queue, and deploys a single-instance Cloud Run GPU service using an NVIDIA L4.
Submissions are durable job records in GCS, then Cloud Tasks dispatches processing one job at a time (`max-concurrent-dispatches=1`).
Cloud Run still allows lightweight concurrent submit/status requests while the one GPU worker task is running.
For the temporary analysis-only mode, the deploy script defaults `SCAN_3D_ENABLED=false`; set `SCAN_3D_ENABLED=true ./deploy.sh` to re-enable FaceLift/turntable generation.

Required GCP state:

- Cloud Run, Cloud Build, Artifact Registry, and Cloud Storage APIs enabled
- Cloud Tasks API enabled
- L4 GPU quota in the deploy region
- Cloud Run runtime service account can write to `GCS_TURNTABLE_BUCKET`
- Cloud Run runtime service account can enqueue Cloud Tasks

After deploy, point the dashboard/server at the returned URL:

```bash
VITE_SCAN_API_URL=https://facelift-scan-api-rm2sqmm74q-uc.a.run.app
MODAL_SCAN_API_URL=https://facelift-scan-api-rm2sqmm74q-uc.a.run.app
CLINIC_SCAN_USE_DEPLOYED_MODAL=true
```

`MODAL_SCAN_API_URL` is still the legacy env var name in `server.py`; the URL can now be the GCP service.

Current verified service:

- `https://facelift-scan-api-778790414190.us-central1.run.app`
- `https://facelift-scan-api-rm2sqmm74q-uc.a.run.app`
