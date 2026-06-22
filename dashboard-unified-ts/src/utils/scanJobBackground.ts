import {
  fetchScanJobStatus,
  getScanApiBaseUrl,
  type ScanProgressEvent,
} from "./scanApi";
import { setGeneratedClientGlbUrl } from "./client3dConfig";
import {
  cacheBustAuraAssetUrl,
  cacheBustPatientAuraManifest,
  setPatientAuraManifest,
  type PatientAuraAssetManifest,
} from "./patientAuraAssets";

export type BackgroundScanQuality = "standard" | "high";
export type BackgroundScanAssetStatus =
  | "queued"
  | "running"
  | "ready"
  | "error";

type BackgroundScanAnalysisFields = {
  analysisComplete?: boolean;
  analysisMessage?: string;
  assetStatus?: BackgroundScanAssetStatus;
  assetProgress?: number;
  assetRemaining?: number;
  assetMessage?: string;
};

type BackgroundScanContextFields = {
  providerId?: string;
  formSubmissionId?: string;
};

export type BackgroundScanSnapshot =
  | ({
      phase: "submitting";
      recordId: string;
      tableName?: string;
      clientName: string;
      apiBase: string;
      quality: BackgroundScanQuality;
      estimatedSeconds: number;
      startedAt: number;
      updatedAt: number;
    } & BackgroundScanAnalysisFields &
      BackgroundScanContextFields)
  | ({
      phase: "running";
      recordId: string;
      tableName?: string;
      clientName: string;
      apiBase: string;
      quality: BackgroundScanQuality;
      estimatedSeconds: number;
      startedAt: number;
      updatedAt: number;
      jobId: string;
      progress: number;
      message: string;
      remaining: number;
      videoUrl?: string;
      auraAssets?: PatientAuraAssetManifest;
      severityScores?: Record<string, unknown>;
      severityPersisted?: boolean;
    } & BackgroundScanAnalysisFields &
      BackgroundScanContextFields)
  | ({
      phase: "done";
      recordId: string;
      tableName?: string;
      clientName: string;
      apiBase: string;
      quality: BackgroundScanQuality;
      estimatedSeconds: number;
      startedAt: number;
      updatedAt: number;
      jobId: string;
      progress: 1;
      message: string;
      remaining: 0;
      videoUrl?: string;
      auraAssets?: PatientAuraAssetManifest;
      severityScores?: Record<string, unknown>;
      severityPersisted?: boolean;
    } & BackgroundScanAnalysisFields &
      BackgroundScanContextFields)
  | ({
      phase: "error";
      recordId: string;
      tableName?: string;
      clientName: string;
      apiBase: string;
      quality: BackgroundScanQuality;
      estimatedSeconds: number;
      startedAt: number;
      updatedAt: number;
      jobId?: string;
      progress: number;
      message: string;
      remaining: number;
      error: string;
    } & BackgroundScanAnalysisFields &
      BackgroundScanContextFields);

type BackgroundScanListener = (
  snapshot: BackgroundScanSnapshot | null,
) => void;

type BackgroundScanCollectionListener = (
  snapshots: BackgroundScanSnapshot[],
) => void;

type BackgroundScanJob = {
  snapshot: BackgroundScanSnapshot;
  pollId: ReturnType<typeof setInterval> | null;
  submitPromise?: Promise<void>;
  savePromise?: Promise<void>;
  saveQueued?: boolean;
  lastSaveSignature?: string;
  severityPersisted?: boolean;
};

type StartBackgroundScanInput = {
  recordId: string;
  tableName?: string;
  clientName: string;
  quality: BackgroundScanQuality;
  estimatedSeconds?: number;
  photos: Record<string, string>;
  patientAge?: number;
  apiBase?: string;
};

type TrackSubmittedBackgroundScanInput = {
  recordId: string;
  tableName?: string;
  clientName?: string;
  quality?: BackgroundScanQuality;
  estimatedSeconds?: number;
  apiBase?: string;
  providerId?: string;
  formSubmissionId?: string;
  jobId: string;
  startedAt?: number;
};

const SCAN_JOB_MAX_AGE_MS = 60 * 60 * 1000;
const SCAN_DONE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SCAN_JOB_STORAGE_PREFIX = "fmp-scan-job:";
const ESTIMATED_SECONDS_FLOOR_BY_QUALITY: Record<
  BackgroundScanQuality,
  number
> = {
  standard: 120,
  high: 180,
};
const ESTIMATED_SECONDS_CEILING_BY_QUALITY: Record<
  BackgroundScanQuality,
  number
> = {
  standard: 180,
  high: 300,
};
const jobs = new Map<string, BackgroundScanJob>();
const listeners = new Map<string, Set<BackgroundScanListener>>();
const collectionListeners = new Set<BackgroundScanCollectionListener>();

function scanJobKey(recordId: string): string {
  return `${SCAN_JOB_STORAGE_PREFIX}${recordId}`;
}

function notify(recordId: string, snapshot: BackgroundScanSnapshot | null): void {
  for (const listener of listeners.get(recordId) ?? []) {
    listener(snapshot);
  }
}

function currentSnapshots(): BackgroundScanSnapshot[] {
  return Array.from(jobs.values())
    .map((job) => job.snapshot)
    .filter((snapshot) => !isStale(snapshot))
    .sort((a, b) => b.startedAt - a.startedAt);
}

function notifyCollectionListeners(): void {
  const snapshots = currentSnapshots();
  for (const listener of collectionListeners) {
    listener(snapshots);
  }
}

function normalizeRecordId(recordId: string): string {
  return recordId.trim();
}

function now(): number {
  return Date.now();
}

function estimatedSecondsFloor(quality: BackgroundScanQuality): number {
  return ESTIMATED_SECONDS_FLOOR_BY_QUALITY[quality] ?? 120;
}

function estimatedSecondsCeiling(quality: BackgroundScanQuality): number {
  return ESTIMATED_SECONDS_CEILING_BY_QUALITY[quality] ?? 180;
}

function normalizeEstimatedSeconds(
  quality: BackgroundScanQuality,
  value: number | undefined,
): number {
  const floor = estimatedSecondsFloor(quality);
  const ceiling = estimatedSecondsCeiling(quality);
  const normalized = Number.isFinite(value ?? NaN)
    ? Math.ceil(value as number)
    : ceiling;
  return Math.max(floor, Math.min(ceiling, normalized));
}

function elapsedSecondsSince(startedAt: number): number {
  return Math.max(0, (now() - startedAt) / 1000);
}

function scanProgressFromEvent(
  data: ScanProgressEvent,
  previousProgress: number,
  analysisComplete: boolean,
): number {
  if (analysisComplete) return 1;
  const raw = typeof data.progress === "number" ? data.progress : previousProgress;
  return Math.max(0.02, Math.min(0.96, raw));
}

function scanRemainingFromEvent(
  data: ScanProgressEvent,
  snapshot: { estimatedSeconds: number; startedAt: number },
  analysisComplete: boolean,
): number {
  if (analysisComplete) return 0;
  const elapsed =
    typeof data.elapsed === "number"
      ? Math.max(0, data.elapsed)
      : elapsedSecondsSince(snapshot.startedAt);
  const estimateRemaining = Math.max(0, snapshot.estimatedSeconds - elapsed);
  const backendRemaining =
    typeof data.remaining === "number" && data.remaining > 0
      ? data.remaining
      : undefined;
  return Math.ceil(
    Math.max(
      0,
      backendRemaining == null
        ? estimateRemaining
        : Math.min(backendRemaining, estimateRemaining),
    ),
  );
}

function normalizeAssetStatus(
  value: string | undefined,
  fallback: BackgroundScanAssetStatus,
): BackgroundScanAssetStatus {
  if (
    value === "queued" ||
    value === "running" ||
    value === "ready" ||
    value === "error"
  ) {
    return value;
  }
  return fallback;
}

function scanAnalysisComplete(data: ScanProgressEvent): boolean {
  return Boolean(
    data.analysisComplete ||
      data.analysisStatus === "done" ||
      data.analysisStatus === "complete" ||
      data.status === "analysis_done" ||
      data.severityScores,
  );
}

function persistSnapshot(snapshot: BackgroundScanSnapshot): void {
  try {
    localStorage.setItem(scanJobKey(snapshot.recordId), JSON.stringify(snapshot));
  } catch {
    /* storage full */
  }
}

function removePersistedSnapshot(recordId: string): void {
  try {
    localStorage.removeItem(scanJobKey(recordId));
  } catch {
    /* ignore */
  }
}

function isStale(snapshot: BackgroundScanSnapshot): boolean {
  const age = now() - snapshot.startedAt;
  return snapshot.phase === "done"
    ? age > SCAN_DONE_MAX_AGE_MS
    : age > SCAN_JOB_MAX_AGE_MS;
}

function normalizePersistedSnapshot(
  recordId: string,
  raw: unknown,
): BackgroundScanSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<BackgroundScanSnapshot> & {
    jobId?: string;
    quality?: string;
    estimatedSeconds?: number;
    startedAt?: number;
  };

  const quality: BackgroundScanQuality =
    value.quality === "high" ? "high" : "standard";
  const startedAt =
    typeof value.startedAt === "number" ? value.startedAt : now();
  const estimatedSeconds = normalizeEstimatedSeconds(
    quality,
    value.estimatedSeconds,
  );

  // Backward compatibility with the old `{ jobId, quality, estimatedSeconds, startedAt }` shape.
  if (!("phase" in value) && value.jobId) {
    return {
      phase: "running",
      recordId,
      clientName: recordId,
      apiBase: getScanApiBaseUrl(),
      quality,
      estimatedSeconds,
      startedAt,
      updatedAt: now(),
      jobId: value.jobId,
      progress: 0.05,
      message: "Resuming scan...",
      remaining: Math.ceil(
        Math.max(0, estimatedSeconds - elapsedSecondsSince(startedAt)),
      ),
    };
  }

  if (
    value.phase !== "submitting" &&
    value.phase !== "running" &&
    value.phase !== "done" &&
    value.phase !== "error"
  ) {
    return null;
  }

  return {
    ...value,
    recordId,
    clientName: value.clientName || recordId,
    apiBase: value.apiBase || getScanApiBaseUrl(),
    quality,
    estimatedSeconds,
    startedAt,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : now(),
  } as BackgroundScanSnapshot;
}

function loadPersistedSnapshot(recordId: string): BackgroundScanSnapshot | null {
  try {
    const raw = localStorage.getItem(scanJobKey(recordId));
    if (!raw) return null;
    const snapshot = normalizePersistedSnapshot(recordId, JSON.parse(raw));
    if (!snapshot || isStale(snapshot)) {
      removePersistedSnapshot(recordId);
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

function persistedRecordIds(): string[] {
  const ids: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(SCAN_JOB_STORAGE_PREFIX)) continue;
      const recordId = key.slice(SCAN_JOB_STORAGE_PREFIX.length).trim();
      if (recordId) ids.push(recordId);
    }
  } catch {
    /* storage unavailable */
  }
  return ids;
}

function putJob(snapshot: BackgroundScanSnapshot): BackgroundScanJob {
  const existing = jobs.get(snapshot.recordId);
  const job: BackgroundScanJob = existing ?? { snapshot, pollId: null };
  job.snapshot = { ...snapshot, updatedAt: now() } as BackgroundScanSnapshot;
  jobs.set(snapshot.recordId, job);
  persistSnapshot(job.snapshot);
  notify(snapshot.recordId, job.snapshot);
  notifyCollectionListeners();
  return job;
}

function stopPolling(recordId: string): void {
  const job = jobs.get(recordId);
  if (job?.pollId) {
    clearInterval(job.pollId);
    job.pollId = null;
  }
}

function objectUrlFromBase64(base64: string): string {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: "video/mp4" }));
}

function scanAssetRefreshToken(snapshot: {
  jobId?: string;
  startedAt: number;
}): string {
  return `${snapshot.jobId || "scan"}-${snapshot.startedAt}`;
}

function refreshScanVideoUrl(
  videoUrl: string | undefined,
  snapshot: { jobId?: string; startedAt: number },
): string | undefined {
  return cacheBustAuraAssetUrl(videoUrl, scanAssetRefreshToken(snapshot));
}

function refreshScanAuraAssets(
  auraAssets: PatientAuraAssetManifest | undefined,
  snapshot: { jobId?: string; startedAt: number },
): PatientAuraAssetManifest | undefined {
  return auraAssets
    ? cacheBustPatientAuraManifest(auraAssets, scanAssetRefreshToken(snapshot))
    : undefined;
}

type ScanOutputSnapshot = Extract<
  BackgroundScanSnapshot,
  { phase: "running" | "done" }
>;

function applyGeneratedAssets(snapshot: ScanOutputSnapshot): void {
  if (snapshot.auraAssets) {
    setPatientAuraManifest(snapshot.clientName, snapshot.auraAssets);
  }
  if (snapshot.videoUrl) {
    setGeneratedClientGlbUrl(snapshot.clientName, snapshot.videoUrl);
  }
}

function getSaveableScanOutputSnapshot(
  recordId: string,
): ScanOutputSnapshot | null {
  const job = jobs.get(recordId);
  const snapshot = job?.snapshot;
  if (!job || !snapshot) return null;
  if (snapshot.phase !== "running" && snapshot.phase !== "done") return null;
  if (!snapshot.tableName || !snapshot.jobId) return null;
  if (!snapshot.videoUrl && !snapshot.auraAssets && !snapshot.severityScores) {
    return null;
  }
  return snapshot;
}

function scanOutputSaveSignature(snapshot: ScanOutputSnapshot): string {
  return JSON.stringify({
    jobId: snapshot.jobId,
    providerId: snapshot.providerId ?? "",
    formSubmissionId: snapshot.formSubmissionId ?? "",
    videoUrl: snapshot.videoUrl ?? "",
    auraAssets: snapshot.auraAssets ?? null,
    severityScores: snapshot.severityScores ?? null,
  });
}

async function persistScanOutputs(recordId: string): Promise<void> {
  const job = jobs.get(recordId);
  if (!job) return;
  job.saveQueued = true;
  if (job.savePromise) return job.savePromise;

  job.savePromise = (async () => {
    while (true) {
      const currentJob = jobs.get(recordId);
      if (!currentJob?.saveQueued) return;
      currentJob.saveQueued = false;

      const snapshot = getSaveableScanOutputSnapshot(recordId);
      if (!snapshot) continue;

      const signature = scanOutputSaveSignature(snapshot);
      if (currentJob.lastSaveSignature === signature) continue;

      await fetch(`${snapshot.apiBase}/api/scan/save-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: snapshot.jobId,
          recordId: snapshot.recordId,
          tableName: snapshot.tableName,
          providerId: snapshot.providerId,
          formSubmissionId: snapshot.formSubmissionId,
          includeSeverity: snapshot.severityScores
            ? !(snapshot.severityPersisted || currentJob.severityPersisted)
            : false,
        }),
      })
        .then(async (r) => {
          const body = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw new Error(
              (body as { error?: string }).error ?? "Scan outputs not ready",
            );
          }
          return body;
        })
        .then(
          (saved: {
            videoUrl?: string | null;
            auraAssets?: PatientAuraAssetManifest;
            severityScores?: Record<string, unknown>;
            persisted?: boolean;
            severityPersisted?: boolean;
          }) => {
            if (saved.persisted === false) {
              throw new Error("Scan outputs were not persisted");
            }
            if (saved.severityPersisted) {
              const latestJob = jobs.get(recordId);
              if (latestJob) latestJob.severityPersisted = true;
            }
            const latest = getSaveableScanOutputSnapshot(recordId);
            if (!latest) return;
            const latestJob = jobs.get(recordId);
            const next: BackgroundScanSnapshot = {
              ...latest,
              videoUrl: refreshScanVideoUrl(
                saved.videoUrl ?? latest.videoUrl,
                latest,
              ),
              auraAssets: refreshScanAuraAssets(
                saved.auraAssets ?? latest.auraAssets,
                latest,
              ),
              severityScores: saved.severityScores ?? latest.severityScores,
              severityPersisted:
                latest.severityPersisted ||
                latestJob?.severityPersisted ||
                saved.severityPersisted,
              updatedAt: now(),
            };
            putJob(next);
            applyGeneratedAssets(next);
          },
        );

      const latestJob = jobs.get(recordId);
      if (latestJob) {
        latestJob.lastSaveSignature = signature;
      }
    }
  })()
    .catch(() => {
      /* non-fatal: polling or opening the detail page can retry */
    })
    .finally(() => {
      const latestJob = jobs.get(recordId);
      if (!latestJob) return;
      latestJob.savePromise = undefined;
      if (latestJob.saveQueued) {
        void persistScanOutputs(recordId);
      }
    });

  return job.savePromise;
}

function updateFromProgress(recordId: string, data: ScanProgressEvent): void {
  const job = jobs.get(recordId);
  const snapshot = job?.snapshot;
  if (!job || !snapshot || snapshot.phase !== "running") return;
  const analysisComplete = scanAnalysisComplete(data);
  const assetStatus = normalizeAssetStatus(
    data.assetStatus,
    data.videoUrl || data.auraAssets ? "ready" : "running",
  );

  if (data.status === "done" || data.status === "partial") {
    stopPolling(recordId);
    const videoUrl =
      data.videoUrl || (data.videoBase64 ? objectUrlFromBase64(data.videoBase64) : undefined);
    const auraAssets = refreshScanAuraAssets(
      data.auraAssets as PatientAuraAssetManifest | undefined,
      snapshot,
    );
    const next: BackgroundScanSnapshot = {
      ...snapshot,
      phase: "done",
      progress: 1,
      message: data.status === "partial"
        ? data.message ?? "Complete with notes"
        : "Complete",
      remaining: 0,
      analysisComplete: true,
      analysisMessage: data.analysisMessage,
      assetStatus: videoUrl || auraAssets ? "ready" : assetStatus,
      assetProgress: 1,
      assetRemaining: 0,
      assetMessage: data.assetMessage,
      videoUrl: refreshScanVideoUrl(videoUrl, snapshot),
      auraAssets,
      severityScores: data.severityScores ?? snapshot.severityScores,
      updatedAt: now(),
    };
    putJob(next);
    applyGeneratedAssets(next);
    void persistScanOutputs(recordId);
    return;
  }

  if (data.status === "error") {
    stopPolling(recordId);
    putJob({
      ...snapshot,
      phase: "error",
      progress: snapshot.phase === "running" ? snapshot.progress : 0,
      message: data.error ?? "Unknown error",
      remaining: 0,
      analysisComplete: snapshot.analysisComplete,
      analysisMessage: snapshot.analysisMessage,
      assetStatus: snapshot.analysisComplete ? "error" : snapshot.assetStatus,
      assetProgress: snapshot.assetProgress,
      assetRemaining: 0,
      assetMessage: snapshot.assetMessage,
      error: data.error ?? "Unknown error",
      updatedAt: now(),
    });
    return;
  }

  const auraAssets = refreshScanAuraAssets(
    data.auraAssets as PatientAuraAssetManifest | undefined,
    snapshot,
  );
  if (auraAssets) {
    setPatientAuraManifest(snapshot.clientName, auraAssets);
  }
  const previousProgress =
    snapshot.phase === "running" ? snapshot.progress : 0.05;
  const effectiveEstimatedSeconds = normalizeEstimatedSeconds(
    snapshot.quality,
    data.estimatedSeconds ?? snapshot.estimatedSeconds,
  );
  const next: BackgroundScanSnapshot = {
    ...snapshot,
    phase: "running",
    estimatedSeconds: effectiveEstimatedSeconds,
    progress: scanProgressFromEvent(data, previousProgress, analysisComplete),
    message: analysisComplete
      ? data.message ??
        data.assetMessage ??
        "Analysis ready — building 3D view..."
      : data.message ?? "Working...",
    remaining: scanRemainingFromEvent(
      data,
      { estimatedSeconds: effectiveEstimatedSeconds, startedAt: snapshot.startedAt },
      analysisComplete,
    ),
    analysisComplete,
    analysisMessage: data.analysisMessage,
    assetStatus,
    assetProgress:
      typeof data.assetProgress === "number"
        ? Math.max(0, Math.min(1, data.assetProgress))
        : snapshot.assetProgress,
    assetRemaining:
      typeof data.assetRemaining === "number"
        ? Math.max(0, Math.ceil(data.assetRemaining))
        : snapshot.assetRemaining,
    assetMessage: data.assetMessage,
    videoUrl:
      refreshScanVideoUrl(data.videoUrl, snapshot) ??
      (snapshot.phase === "running" ? snapshot.videoUrl : undefined),
    auraAssets: auraAssets ?? (snapshot.phase === "running" ? snapshot.auraAssets : undefined),
    severityScores: data.severityScores ?? snapshot.severityScores,
    updatedAt: now(),
  };
  putJob(next);
  if (next.videoUrl || next.auraAssets || next.severityScores) {
    applyGeneratedAssets(next);
    void persistScanOutputs(recordId);
  }
}

async function pollScan(recordId: string): Promise<void> {
  const snapshot = jobs.get(recordId)?.snapshot;
  if (!snapshot || snapshot.phase !== "running") return;
  const data = await fetchScanJobStatus(snapshot.apiBase, snapshot.jobId);
  if (data) updateFromProgress(recordId, data);
}

function ensurePolling(recordId: string): void {
  const job = jobs.get(recordId);
  if (!job || job.pollId || job.snapshot.phase !== "running") return;
  void pollScan(recordId);
  job.pollId = setInterval(() => {
    void pollScan(recordId);
  }, 1000);
}

export function getBackgroundScanSnapshot(
  rawRecordId: string | null | undefined,
): BackgroundScanSnapshot | null {
  const recordId = normalizeRecordId(rawRecordId ?? "");
  if (!recordId) return null;
  const existing = jobs.get(recordId)?.snapshot;
  if (existing) return existing;
  const loaded = loadPersistedSnapshot(recordId);
  if (!loaded) return null;
  jobs.set(recordId, { snapshot: loaded, pollId: null });
  if (loaded.phase === "running") ensurePolling(recordId);
  return loaded;
}

export function getAllBackgroundScanSnapshots(): BackgroundScanSnapshot[] {
  const recordIds = new Set<string>([...jobs.keys(), ...persistedRecordIds()]);
  const snapshots: BackgroundScanSnapshot[] = [];
  for (const recordId of recordIds) {
    const snapshot = getBackgroundScanSnapshot(recordId);
    if (snapshot) snapshots.push(snapshot);
  }
  return snapshots.sort((a, b) => b.startedAt - a.startedAt);
}

export function subscribeBackgroundScanJob(
  rawRecordId: string,
  listener: BackgroundScanListener,
): () => void {
  const recordId = normalizeRecordId(rawRecordId);
  if (!recordId) return () => {};
  const set = listeners.get(recordId) ?? new Set<BackgroundScanListener>();
  set.add(listener);
  listeners.set(recordId, set);

  const snapshot = getBackgroundScanSnapshot(recordId);
  if (snapshot) listener(snapshot);
  if (snapshot?.phase === "running") ensurePolling(recordId);

  return () => {
    const current = listeners.get(recordId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(recordId);
  };
}

export function subscribeAllBackgroundScanJobs(
  listener: BackgroundScanCollectionListener,
): () => void {
  collectionListeners.add(listener);
  listener(getAllBackgroundScanSnapshots());

  return () => {
    collectionListeners.delete(listener);
  };
}

export function updateBackgroundScanJobMetadata(
  rawRecordId: string | null | undefined,
  metadata: { clientName?: string; tableName?: string },
): void {
  const recordId = normalizeRecordId(rawRecordId ?? "");
  if (!recordId) return;
  const snapshot = getBackgroundScanSnapshot(recordId);
  if (!snapshot) return;
  const clientName = metadata.clientName?.trim() || snapshot.clientName;
  const tableName = metadata.tableName || snapshot.tableName;
  if (clientName === snapshot.clientName && tableName === snapshot.tableName) {
    return;
  }
  putJob({
    ...snapshot,
    clientName,
    tableName,
    updatedAt: now(),
  } as BackgroundScanSnapshot);
}

export function startBackgroundScanJob(input: StartBackgroundScanInput): void {
  const recordId = normalizeRecordId(input.recordId);
  if (!recordId) return;

  stopPolling(recordId);
  jobs.delete(recordId);
  removePersistedSnapshot(recordId);
  const apiBase = input.apiBase?.trim().replace(/\/$/, "") || getScanApiBaseUrl();
  const estimatedSeconds = normalizeEstimatedSeconds(
    input.quality,
    input.estimatedSeconds,
  );
  const startedAt = now();
  const submitting = putJob({
    phase: "submitting",
    recordId,
    tableName: input.tableName,
    clientName: input.clientName,
    apiBase,
    quality: input.quality,
    estimatedSeconds,
    startedAt,
    updatedAt: startedAt,
  });

  submitting.submitPromise = (async () => {
    try {
      const res = await fetch(`${apiBase}/api/scan/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: input.recordId,
          tableName: input.tableName,
          clientName: input.clientName,
          quality: input.quality,
          photos: input.photos,
          patientAge: input.patientAge,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((body as { error?: string }).error ?? res.statusText);
      }
      const data = (await res.json()) as {
        jobId: string;
        estimatedSeconds?: number;
      };
      putJob({
        phase: "running",
        recordId,
        tableName: input.tableName,
        clientName: input.clientName,
        apiBase,
        quality: input.quality,
        estimatedSeconds: normalizeEstimatedSeconds(
          input.quality,
          data.estimatedSeconds ?? estimatedSeconds,
        ),
        startedAt,
        updatedAt: now(),
        jobId: data.jobId,
        progress: 0.01,
        message: "Starting...",
        remaining: normalizeEstimatedSeconds(
          input.quality,
          data.estimatedSeconds ?? estimatedSeconds,
        ),
      });
      ensurePolling(recordId);
    } catch (err) {
      putJob({
        phase: "error",
        recordId,
        tableName: input.tableName,
        clientName: input.clientName,
        apiBase,
        quality: input.quality,
        estimatedSeconds,
        startedAt,
        updatedAt: now(),
        progress: 0,
        message: err instanceof Error ? err.message : String(err),
        remaining: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}

export function trackSubmittedBackgroundScanJob(
  input: TrackSubmittedBackgroundScanInput,
): void {
  const recordId = normalizeRecordId(input.recordId);
  const jobId = input.jobId.trim();
  if (!recordId || !jobId) return;

  const apiBase = input.apiBase?.trim().replace(/\/$/, "") || getScanApiBaseUrl();
  const existing = getBackgroundScanSnapshot(recordId);
  const matchingExisting =
    existing && "jobId" in existing && existing.jobId === jobId ? existing : null;
  const quality = input.quality ?? matchingExisting?.quality ?? "standard";
  const estimatedSeconds = normalizeEstimatedSeconds(
    quality,
    input.estimatedSeconds ?? matchingExisting?.estimatedSeconds,
  );
  const startedAt = input.startedAt ?? matchingExisting?.startedAt ?? now();
  const providerId = input.providerId?.trim() || matchingExisting?.providerId;
  const formSubmissionId =
    input.formSubmissionId?.trim() || matchingExisting?.formSubmissionId;

  stopPolling(recordId);
  putJob({
    phase: "running",
    recordId,
    tableName: input.tableName,
    clientName: input.clientName?.trim() || matchingExisting?.clientName || recordId,
    apiBase,
    quality,
    estimatedSeconds,
    startedAt,
    updatedAt: now(),
    providerId,
    formSubmissionId,
    jobId,
    progress: matchingExisting?.phase === "running" ? matchingExisting.progress : 0.02,
    message: matchingExisting?.phase === "running"
      ? matchingExisting.message
      : "Processing scan...",
    remaining: matchingExisting?.phase === "running"
      ? Math.min(matchingExisting.remaining, estimatedSeconds)
      : estimatedSeconds,
    videoUrl: matchingExisting && "videoUrl" in matchingExisting
      ? matchingExisting.videoUrl
      : undefined,
    auraAssets: matchingExisting && "auraAssets" in matchingExisting
      ? matchingExisting.auraAssets
      : undefined,
    severityScores: matchingExisting && "severityScores" in matchingExisting
      ? matchingExisting.severityScores
      : undefined,
    severityPersisted: matchingExisting && "severityPersisted" in matchingExisting
      ? matchingExisting.severityPersisted
      : undefined,
  });
  ensurePolling(recordId);
}

export function clearBackgroundScanJob(rawRecordId: string | null | undefined): void {
  const recordId = normalizeRecordId(rawRecordId ?? "");
  if (!recordId) return;
  stopPolling(recordId);
  jobs.delete(recordId);
  removePersistedSnapshot(recordId);
  notify(recordId, null);
  notifyCollectionListeners();
}
