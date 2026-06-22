#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-plasma-matter-469702-s1}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="${GCP_SCAN_SERVICE_NAME:-facelift-scan-api}"
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/facelift-scan-api:latest"
BUCKET="${GCS_TURNTABLE_BUCKET:-test-deploy-august25}"
SEVERITY_URL="${SEVERITY_PREDICT_URL:-https://patient-analysis-service-rm2sqmm74q-uc.a.run.app/predict}"
SCAN_3D_ENABLED="${SCAN_3D_ENABLED:-false}"
CLOUD_TASKS_QUEUE="${CLOUD_TASKS_QUEUE:-facelift-scan-jobs}"
CLOUD_TASKS_LOCATION="${CLOUD_TASKS_LOCATION:-${REGION}}"

gcloud services enable cloudtasks.googleapis.com \
  --project "${PROJECT_ID}"

if gcloud tasks queues describe "${CLOUD_TASKS_QUEUE}" \
  --project "${PROJECT_ID}" \
  --location "${CLOUD_TASKS_LOCATION}" >/dev/null 2>&1; then
  gcloud tasks queues update "${CLOUD_TASKS_QUEUE}" \
    --project "${PROJECT_ID}" \
    --location "${CLOUD_TASKS_LOCATION}" \
    --max-concurrent-dispatches 1 \
    --max-dispatches-per-second 1 \
    --max-attempts 3
else
  gcloud tasks queues create "${CLOUD_TASKS_QUEUE}" \
    --project "${PROJECT_ID}" \
    --location "${CLOUD_TASKS_LOCATION}" \
    --max-concurrent-dispatches 1 \
    --max-dispatches-per-second 1 \
    --max-attempts 3
fi

gcloud builds submit \
  --project "${PROJECT_ID}" \
  --config cloudbuild.yaml \
  --timeout 90m

gcloud beta run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --platform managed \
  --image "${IMAGE}" \
  --allow-unauthenticated \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --no-gpu-zonal-redundancy \
  --cpu 4 \
  --memory 16Gi \
  --timeout 3600 \
  --max-instances 1 \
  --concurrency 10 \
  --no-cpu-throttling \
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID},GCS_TURNTABLE_BUCKET=${BUCKET},SEVERITY_PREDICT_URL=${SEVERITY_URL},SCAN_3D_ENABLED=${SCAN_3D_ENABLED},CLOUD_TASKS_QUEUE=${CLOUD_TASKS_QUEUE},CLOUD_TASKS_LOCATION=${CLOUD_TASKS_LOCATION}"

gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format "value(status.url)"
