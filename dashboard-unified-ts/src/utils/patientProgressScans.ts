import type {
  AnalysisSeverityIssue,
  AnalysisSeverityScoresData,
  Client,
  ClientPhotoSlot,
} from "../types";
import type { PatientAuraAssetManifest } from "./patientAuraAssets";

export type ProgressMetricKey =
  | "pigmentation"
  | "redness"
  | "pores"
  | "wrinkles"
  | "volume"
  | "structure";

export type ProgressMetric = {
  key: ProgressMetricKey;
  label: string;
  value: number;
};

export type PatientProgressScan = {
  id: string;
  label: string;
  dateIso: string;
  dateLabel: string;
  photoSlots?: ClientPhotoSlot[];
  turntableVideoUrl?: string | null;
  auraManifest?: PatientAuraAssetManifest | null;
  severityScores?: AnalysisSeverityScoresData | null;
  metrics: ProgressMetric[];
};

type ClientProgressScanRecord = {
  id?: string;
  label?: string;
  date?: string;
  dateIso?: string;
  scannedAt?: string;
  createdAt?: string;
  photoSlots?: ClientPhotoSlot[];
  turntableVideoUrl?: string | null;
  auraManifest?: PatientAuraAssetManifest | null;
  severityScores?: AnalysisSeverityScoresData | null;
  severityScoresFromAnalyses?: AnalysisSeverityScoresData | null;
  metrics?: Partial<Record<ProgressMetricKey, number>>;
};

type ClientWithProgressScans = Client & {
  facialAnalysisScans?: ClientProgressScanRecord[];
  progressScans?: ClientProgressScanRecord[];
};

const METRIC_DEFS: Array<{
  key: ProgressMetricKey;
  label: string;
  terms: string[];
}> = [
  {
    key: "pigmentation",
    label: "Pigmentation",
    terms: ["pigment", "dark spot", "discolor", "melasma", "tone"],
  },
  {
    key: "redness",
    label: "Redness",
    terms: ["red", "rosacea", "irritation", "inflam"],
  },
  {
    key: "pores",
    label: "Pores",
    terms: ["pore", "whitehead", "blackhead", "acne", "comedone"],
  },
  {
    key: "wrinkles",
    label: "Wrinkles",
    terms: ["wrinkle", "line", "crow", "forehead", "glabella", "perioral"],
  },
  {
    key: "volume",
    label: "Volume",
    terms: ["volume", "hollow", "cheek", "temple", "tear trough"],
  },
  {
    key: "structure",
    label: "Structure",
    terms: ["jaw", "chin", "asymmetry", "proportion", "brow"],
  },
];

function formatScanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Undated scan";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function normalizeDate(value: string | undefined | null): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function severityValue(issue: AnalysisSeverityIssue | undefined): number | null {
  if (!issue) return null;
  const normalized = issue.severity_normalized_0_1;
  if (typeof normalized === "number" && Number.isFinite(normalized)) {
    return Math.round(Math.max(0, Math.min(1, normalized)) * 100);
  }
  const raw =
    typeof issue.severity === "number"
      ? issue.severity
      : typeof issue.probability === "number"
        ? issue.probability
        : null;
  if (raw == null || !Number.isFinite(raw)) return null;
  return Math.round(Math.max(0, Math.min(100, raw <= 1 ? raw * 100 : raw)));
}

function metricFromSeverity(
  severityScores: AnalysisSeverityScoresData | null | undefined,
  terms: string[],
): number | null {
  const issues = severityScores?.issues ?? {};
  const values = Object.entries(issues)
    .filter(([issue]) => {
      const lower = issue.toLowerCase();
      return terms.some((term) => lower.includes(term));
    })
    .map(([, issue]) => severityValue(issue))
    .filter((value): value is number => value != null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildMetrics(
  recordMetrics: ClientProgressScanRecord["metrics"] | undefined,
  severityScores: AnalysisSeverityScoresData | null | undefined,
): ProgressMetric[] {
  return METRIC_DEFS.map((def) => {
    const explicit = recordMetrics?.[def.key];
    const value =
      typeof explicit === "number" && Number.isFinite(explicit)
        ? explicit
        : metricFromSeverity(severityScores, def.terms);
    return {
      key: def.key,
      label: def.label,
      value: Math.round(Math.max(0, Math.min(100, value ?? 0))),
    };
  });
}

function recordDate(record: ClientProgressScanRecord, fallback: string): string {
  return normalizeDate(
    record.dateIso ?? record.scannedAt ?? record.date ?? record.createdAt ?? fallback,
  );
}

export function buildPatientProgressScans(input: {
  client: Client;
  photoSlots?: ClientPhotoSlot[];
  turntableVideoUrl?: string | null;
  auraManifest?: PatientAuraAssetManifest | null;
}): PatientProgressScan[] {
  const withScans = input.client as ClientWithProgressScans;
  const records = withScans.facialAnalysisScans ?? withScans.progressScans ?? [];
  const fallbackDate = normalizeDate(input.client.createdAt);

  if (records.length > 0) {
    return records
      .map((record, index): PatientProgressScan => {
        const dateIso = recordDate(record, fallbackDate);
        const severityScores =
          record.severityScores ??
          record.severityScoresFromAnalyses ??
          input.client.severityScoresFromAnalyses ??
          null;
        return {
          id: record.id || `scan-${index + 1}-${dateIso.slice(0, 10)}`,
          label: record.label || `${formatScanDate(dateIso)} scan`,
          dateIso,
          dateLabel: formatScanDate(dateIso),
          photoSlots: record.photoSlots ?? input.photoSlots,
          turntableVideoUrl:
            record.turntableVideoUrl ?? input.turntableVideoUrl ?? input.client.turntableVideoUrl,
          auraManifest: record.auraManifest ?? input.auraManifest,
          severityScores,
          metrics: buildMetrics(record.metrics, severityScores),
        };
      })
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  }

  const severityScores = input.client.severityScoresFromAnalyses ?? null;
  const dateIso = fallbackDate;
  return [
    {
      id: `scan-current-${input.client.id}`,
      label: `${formatScanDate(dateIso)} scan`,
      dateIso,
      dateLabel: formatScanDate(dateIso),
      photoSlots: input.photoSlots,
      turntableVideoUrl: input.turntableVideoUrl ?? input.client.turntableVideoUrl,
      auraManifest: input.auraManifest,
      severityScores,
      metrics: buildMetrics(undefined, severityScores),
    },
  ];
}

export function sortProgressScansChronologically(
  scans: PatientProgressScan[],
): PatientProgressScan[] {
  return [...scans].sort(
    (a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime(),
  );
}

/** Oldest + newest scan — default baseline/follow-up pair for compare view. */
export function defaultCompareScanPair(
  scans: PatientProgressScan[],
): [PatientProgressScan, PatientProgressScan] | null {
  const sorted = sortProgressScansChronologically(scans);
  if (sorted.length < 2) return null;
  return [sorted[sorted.length - 2]!, sorted[sorted.length - 1]!];
}

export function scanMetricByKey(
  scan: PatientProgressScan,
  key: ProgressMetricKey,
): ProgressMetric | undefined {
  return scan.metrics.find((metric) => metric.key === key);
}

