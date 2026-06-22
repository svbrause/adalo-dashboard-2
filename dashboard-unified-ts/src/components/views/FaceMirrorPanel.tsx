import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSequentialTypewriter } from "../../hooks/useSequentialTypewriter";
import type { Client, ClientPhotoSlot, DiscussedItem } from "../../types";
import type {
  TreatmentPlanAddDirectOptions,
  TreatmentPlanPrefill,
} from "../modals/DiscussedTreatmentsModal/TreatmentPhotos";
import { TREATMENT_BOUTIQUE_SKINCARE } from "../modals/DiscussedTreatmentsModal/treatmentBoutiqueProducts";
import AnalysisOverviewModal from "../modals/AnalysisOverviewModal";
import {
  AiMirrorCanvas,
  getHighlightedRegionIds,
  hasMirrorAnnotationHighlights,
} from "../postVisitBlueprint/AiMirrorCanvas";
import AutoRotateHeadIcon from "../common/AutoRotateHeadIcon";
import Face3DViewer from "./Face3DViewer";
import FaceMirrorRegionsPicker, {
  ALL_MIRROR_ANNOTATION_REGION_IDS,
  type FaceMirrorHighlightOption,
} from "./FaceMirrorRegionsPicker";
import AuraFaceView, {
  type AnnotateSavePayload,
  type ViewAngle,
} from "../aura/AuraFaceView";
import AnnotateDrawing, { type AnnotateStroke } from "../aura/AnnotateDrawing";
import {
  clientUsesAuraInterface,
  clientUsesAuraScan,
} from "../../utils/auraScanConfig";
import {
  savePatientAnnotation,
  type SavedPatientAnnotation,
} from "../../utils/patientAnnotationsStorage";
import {
  compositeCompareAnnotation,
  downloadDataUrl,
  sanitizeDownloadFilename,
} from "../../utils/annotationComposite";
import {
  buildViewerAngleAssetsFromManifest,
  hasGeneratedAuraStillAssets,
  resolvePatientAuraManifest,
  getAvailableViewAngles,
  getPatientAuraManifest,
  pickPreferredPatientAuraManifest,
  setPatientAuraManifest,
  type PatientAuraAssetManifest,
} from "../../utils/patientAuraAssets";
import {
  buildViewerAngleAssetsFromPhotoSlots,
  inferAvailableViewAnglesFromPhotoSlots,
  TANYA_TAN_LEFT_NAV_ORDER,
  TANYA_TAN_VIEWER_ANGLE_ASSETS,
} from "../../utils/auraTanAnglePhotos";
import {
  alignAvailableViewAnglesByFacing,
  alignViewerAngleAssetsByFacing,
  collectFacingDetectionUrls,
  detectPhotoFacingDirection,
  type AuraPhotoFacingByUrl,
} from "../../utils/auraPhotoFacingDetection";
import aura45LeftIcon from "../../assets/images/aura-45degrees-left.png";
import aura45RightIcon from "../../assets/images/aura-45degrees-right.png";
import aura90LeftIcon from "../../assets/images/aura-90degrees-left.png";
import aura90RightIcon from "../../assets/images/aura-90degrees-right.png";
import auraFrontIcon from "../../assets/images/aura-facing-ahead.png";
import type {
  AuraOverviewCategoryKey,
  AuraSkinLens,
} from "../../utils/auraAnalysisBridge";
import {
  collectIssuesForSkinLens,
  detectedIssuesForCategory,
  detectedIssuesForSubScore,
  issueToMirrorHighlightTerm,
  AURA_ANALYSIS_AREA_ALL,
  isAuraAnalysisAreaFiltered,
} from "../../utils/auraAnalysisBridge";
import {
  buildDefaultTabSeverityHighlights,
  buildAnalysisAreaFaceHighlights,
  buildSkinLensDefaultHighlights,
} from "../../utils/auraTabDefaultHighlights";
import {
  CATEGORIES,
  canonicalIssueDisplayLabel,
  normalizeIssue,
} from "../../config/analysisOverviewConfig";
import {
  getDetectedIssuesFromClient,
  getDetectedIssueDisplayStrings,
  getEffectiveSeverityIssues,
} from "../../utils/analysisOverviewClient";
import {
  SUB_SCORE_MINIMAP_REGIONS,
  issueSeverityVisual,
} from "../../utils/auraSeverityDisplay";
import type { AuraMirrorHighlightBridge } from "./AuraEmbeddedAnalysisPanel";
import {
  buildPatientProgressScans,
  scanMetricByKey,
  sortProgressScansChronologically,
  type PatientProgressScan,
  type ProgressMetricKey,
} from "../../utils/patientProgressScans";
import {
  faceMirrorHighlightStorageKey,
  loadFaceMirrorHighlightedRegions,
  saveFaceMirrorHighlightedRegions,
} from "../../utils/faceMirrorHighlightStorage";
import {
  clearBackgroundScanJob,
  getBackgroundScanSnapshot,
  startBackgroundScanJob,
  subscribeBackgroundScanJob,
  updateBackgroundScanJobMetadata,
  type BackgroundScanQuality,
  type BackgroundScanSnapshot,
} from "../../utils/scanJobBackground";
import { mapSlotsToModalPhotos } from "../../utils/scanPhotoMapping";
import {
  clampViewportZoom,
  type ViewportTransform,
} from "../../utils/mirrorViewportZoomMath";
import type { CompareViewportPaneApi } from "../../hooks/useMirrorViewportZoom";
import "./FaceMirrorPanel.css";

// ---------------------------------------------------------------------------
// 3D Scan generation types
// ---------------------------------------------------------------------------
/** Set to true to re-enable the Generate 3D Scan toolbar button and config panel. */
const GENERATE_3D_SCAN_ENABLED = true;

type ScanQuality = BackgroundScanQuality;

const COMPARE_ANGLE_LABELS: Record<ViewAngle, string> = {
  "profile-left": "Left profile",
  "three-quarter-left": "Left 45",
  front: "Front",
  "three-quarter-right": "Right 45",
  "profile-right": "Right profile",
};

const COMPARE_ANGLE_ICON_SRC: Record<ViewAngle, string> = {
  "profile-left": aura90LeftIcon,
  "three-quarter-left": aura45LeftIcon,
  front: auraFrontIcon,
  "three-quarter-right": aura45RightIcon,
  "profile-right": aura90RightIcon,
};

const COMPARE_VIEWPORT_DEFAULT_ZOOM = 1.42;
const COMPARE_VIEWPORT_MIN_ZOOM = 0.7;
const COMPARE_VIEWPORT_DEFAULT_PAN_Y = -72;

function defaultCompareViewportTransform(): ViewportTransform {
  return {
    zoom: COMPARE_VIEWPORT_DEFAULT_ZOOM,
    panX: 0,
    panY: COMPARE_VIEWPORT_DEFAULT_PAN_Y,
  };
}

function parseLoggedTreatmentEntry(entry: string): {
  name: string;
  timing: string;
} {
  const splitIndex = entry.lastIndexOf(" · ");
  if (splitIndex === -1) return { name: entry, timing: "" };
  return {
    name: entry.slice(0, splitIndex),
    timing: entry.slice(splitIndex + 3),
  };
}

function CompareAnnotateIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function CompareLinkZoomIcon({ linked }: { linked: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      {linked ? (
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      ) : (
        <path d="M8 11V8a4 4 0 0 1 7.8-2" />
      )}
    </svg>
  );
}

type CompareModeOption = {
  id: ProgressMetricKey;
  label: string;
  category: AuraOverviewCategoryKey;
  skinLens?: AuraSkinLens;
};

const COMPARE_MODE_OPTIONS: CompareModeOption[] = [
  {
    id: "pigmentation",
    label: "Pigmentation",
    category: "skinHealth",
    skinLens: "pigmentation",
  },
  {
    id: "redness",
    label: "Redness",
    category: "skinHealth",
    skinLens: "redness",
  },
  { id: "pores", label: "Pores", category: "skinHealth", skinLens: "pores" },
  {
    id: "wrinkles",
    label: "Wrinkles",
    category: "skinHealth",
    skinLens: "wrinkles",
  },
  { id: "volume", label: "Volume", category: "volumeLoss" },
  { id: "structure", label: "Structure", category: "proportions" },
];

function severityScalePercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

type ProgressSeverityBand = {
  key: "green" | "yellow" | "red";
  label: string;
  cssClass: string;
  color: string;
};

function progressSeverityBand(value: number): ProgressSeverityBand {
  if (value >= 60) {
    return {
      key: "red",
      label: "High",
      cssClass: "is-red",
      color: "#ef4444",
    };
  }
  if (value >= 35) {
    return {
      key: "yellow",
      label: "Medium",
      cssClass: "is-yellow",
      color: "#f59e0b",
    };
  }
  return {
    key: "green",
    label: "Low",
    cssClass: "is-green",
    color: "#22c55e",
  };
}

type ProgressCopilotDraft = {
  statusLabel: string;
  goal: string;
  goalConnection: string;
  primaryTakeaway: string;
  providerCue: string;
  nextBestStep: string;
  patientContext: string;
  priorContext: string;
  treatmentJourney: string;
  outcomeNarrative: string;
  clinicalStory: string;
  nextStepLabel: string;
  nextStepDetail: string;
  suggestions: ProgressCopilotSuggestion[];
  narrative: string;
  nextDiscussion: string;
  confidence: "High" | "Moderate" | "Low";
  uncertainty: string;
  groundedFindings: string[];
  loggedTreatments: string[];
  providerNote: string;
  patientSummary: string;
  chartNote: string;
  nextSteps: string;
};

type ProgressCopilotProductLink = {
  name: string;
  shortName: string;
  imageUrl?: string;
  productUrl: string;
  price?: string;
};

type ProgressCopilotSuggestion = {
  kind: "skincare" | "treatment";
  detail: string;
  products?: ProgressCopilotProductLink[];
};

type ProgressCopilotConfig = {
  goal: string;
  skinComplaints: string;
  previousTreatmentContext: string;
  focusMetricKey: ProgressMetricKey;
  includedTreatmentIds: string[];
};

const PROGRESS_COPILOT_GOAL_PRESETS = [
  "Look clearer and more even-toned with less visible dark spotting before an upcoming event",
  "Reduce redness and improve skin texture and tone",
  "Refresh with natural rejuvenation and maintained expressiveness",
  "Volume restoration and lower-face rejuvenation",
] as const;

const PROGRESS_COPILOT_FOCUS_OPTIONS: Array<{
  id: ProgressMetricKey;
  label: string;
}> = [
  { id: "pigmentation", label: "Pigmentation" },
  { id: "redness", label: "Redness" },
  { id: "pores", label: "Pores" },
  { id: "wrinkles", label: "Wrinkles" },
  { id: "volume", label: "Volume" },
  { id: "structure", label: "Structure" },
];

const PRIOR_EXPERIENCE_CHIPS = [
  "Skincare only",
  "Peels",
  "Laser / IPL",
  "Neuromodulators",
  "Fillers",
  "Microneedling",
  "HydraFacial",
  "None logged",
] as const;

function toggleChipInString(current: string, chip: string): string {
  const parts = current
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const lower = chip.toLowerCase();
  const idx = parts.findIndex((p) => p.toLowerCase() === lower);
  if (idx >= 0) {
    parts.splice(idx, 1);
  } else {
    parts.push(chip);
  }
  return parts.join(", ");
}

function isChipActive(current: string, chip: string): boolean {
  return current
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(chip.toLowerCase());
}

type ProgressCopilotChange = {
  id: ProgressMetricKey;
  label: string;
  before: number;
  after: number;
  delta: number;
  improvement: number;
  regionIds: string[];
  regionInsights: ProgressRegionInsight[];
  narrativeLabel: string;
  narrativeDetail: string;
};

type ProgressRegionInsight = {
  regionId: string;
  label: string;
  improvementText: string;
  sortKey: number;
};

const PROGRESS_REGION_LABELS: Record<string, string> = {
  rForehead: "Forehead",
  rLeftEye: "Left eye",
  rRightEye: "Right eye",
  rNose: "Nose",
  rCheeks: "Cheeks",
  rLeftCheek: "Left cheek",
  rRightCheek: "Right cheek",
  rLips: "Lips",
  rChin: "Chin",
  rLeftUnderEye: "Left under eye",
  rRightUnderEye: "Right under eye",
  rLeftNasolabialFold: "Left nasolabial",
  rRightNasolabialFold: "Right nasolabial",
  rLeftMarionetteLine: "Left marionette",
  rRightMarionetteLine: "Right marionette",
  rLowerFace: "Lower face",
};

/** Virtual region that represents both cheeks together. */
const CHEEKS_VIRTUAL_ID = "rCheeks";
const CHEEKS_CONSTITUENT_IDS = ["rLeftCheek", "rRightCheek"] as const;

/** Expand a virtual region ID to the underlying anatomical region IDs. */
function expandVirtualRegionId(regionId: string): string[] {
  return regionId === CHEEKS_VIRTUAL_ID ? [...CHEEKS_CONSTITUENT_IDS] : [regionId];
}

const PROGRESS_REGION_SEVERITY_OFFSETS: Partial<
  Record<ProgressMetricKey, Record<string, number>>
> = {
  pigmentation: {
    rForehead: -24,
    rLeftCheek: 10,
    rRightCheek: 10,
    rNose: 4,
  },
  redness: {
    rForehead: -12,
    rLeftCheek: 10,
    rRightCheek: 10,
    rNose: 6,
    rChin: 4,
  },
  pores: {
    rForehead: -10,
    rLeftCheek: 4,
    rRightCheek: 4,
    rNose: 16,
  },
  wrinkles: {
    rForehead: 14,
    rLeftEye: 10,
    rRightEye: 10,
    rLeftCheek: -12,
    rRightCheek: -12,
  },
  volume: {
    rForehead: -10,
    rLeftCheek: 8,
    rRightCheek: 8,
  },
  structure: {
    rForehead: -8,
    rNose: 4,
    rChin: 8,
  },
};

function progressRegionalSeverityValue(
  metricKey: ProgressMetricKey,
  value: number,
  regionId: string,
): number {
  const ids = expandVirtualRegionId(regionId);
  const avg =
    ids.reduce((sum, id) => {
      return sum + (PROGRESS_REGION_SEVERITY_OFFSETS[metricKey]?.[id] ?? 0);
    }, 0) / ids.length;
  return severityScalePercent(value + avg);
}

function progressRegionalSeverityBand(
  metricKey: ProgressMetricKey,
  value: number,
  regionId: string,
): ProgressSeverityBand {
  return progressSeverityBand(
    progressRegionalSeverityValue(metricKey, value, regionId),
  );
}

function progressRegionImprovementText(
  beforeRaw: number,
  afterRaw: number,
): string {
  const improvement = beforeRaw - afterRaw;
  if (improvement <= 0) {
    if (afterRaw > beforeRaw) {
      const increase = Math.max(
        1,
        Math.round(((afterRaw - beforeRaw) / Math.max(beforeRaw, 1)) * 100),
      );
      return `${increase}% increase`;
    }
    return "Stable";
  }
  const center = Math.max(
    1,
    Math.round((improvement / Math.max(beforeRaw, 1)) * 100),
  );
  const spread = Math.max(3, Math.round(center * 0.18));
  const low = Math.max(1, center - spread);
  const high = center + spread;
  return `${low}–${high}% improvement`;
}

function buildProgressRegionInsights(
  change: Pick<
    ProgressCopilotChange,
    "id" | "before" | "after" | "regionIds"
  >,
): ProgressRegionInsight[] {
  const hasBothCheeks =
    CHEEKS_CONSTITUENT_IDS.every((id) => change.regionIds.includes(id));

  const resolvedIds = hasBothCheeks
    ? [
        ...change.regionIds.filter((id) => !CHEEKS_CONSTITUENT_IDS.includes(id as typeof CHEEKS_CONSTITUENT_IDS[number])),
        CHEEKS_VIRTUAL_ID,
      ]
    : change.regionIds;

  return resolvedIds
    .map((regionId) => {
      const ids = expandVirtualRegionId(regionId);
      const avgOffset =
        ids.reduce((sum, id) => sum + (PROGRESS_REGION_SEVERITY_OFFSETS[change.id]?.[id] ?? 0), 0) /
        ids.length;
      const beforeRaw = change.before + avgOffset;
      const afterRaw = change.after + avgOffset;
      return {
        regionId,
        label: PROGRESS_REGION_LABELS[regionId] ?? regionId,
        improvementText: progressRegionImprovementText(beforeRaw, afterRaw),
        sortKey: beforeRaw - afterRaw,
      };
    })
    .sort((a, b) => b.sortKey - a.sortKey);
}

const PROGRESS_COPILOT_REGION_FALLBACKS: Partial<
  Record<ProgressMetricKey, string[]>
> = {
  pigmentation: ["rForehead", "rLeftCheek", "rRightCheek"],
  redness: ["rLeftCheek", "rRightCheek"],
  pores: ["rLeftCheek", "rRightCheek", "rNose"],
  wrinkles: ["rForehead", "rLeftEye", "rRightEye"],
  volume: ["rLeftUnderEye", "rRightUnderEye", "rLeftCheek", "rRightCheek"],
  structure: ["rLowerFace"],
};

const PROGRESS_TRACKING_COPILOT_TITLE = "Copilot";

const PROGRESS_COPILOT_CHANGE_STORIES: Record<
  ProgressMetricKey,
  { label: string; detail: string }
> = {
  pigmentation: {
    label: "Tone looks more even",
    detail: "Cheek and forehead spots are quieter in the follow-up view.",
  },
  redness: {
    label: "Skin looks calmer",
    detail: "Background redness is lower, especially through the cheeks.",
  },
  pores: {
    label: "Texture reads smoother",
    detail: "Pore signal is lower in the central face and cheeks.",
  },
  wrinkles: {
    label: "Lines remain controlled",
    detail: "Fine-line signal is stable to improved on this scan.",
  },
  volume: {
    label: "Support is maintained",
    detail: "Cheek support appears stable, helping the face read refreshed.",
  },
  structure: {
    label: "Balance is stable",
    detail: "Profile structure remains consistent between scans.",
  },
};

function primaryProgressMetricKey(
  beforeScan: PatientProgressScan,
  afterScan: PatientProgressScan,
): ProgressMetricKey {
  const ranked = COMPARE_MODE_OPTIONS.map((option) => {
    const change = progressMetricChange(beforeScan, afterScan, option.id);
    if (!change) return null;
    return {
      id: option.id,
      improvement: change.improvement,
      absDelta: Math.abs(change.delta),
    };
  })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => {
      if (b.improvement !== a.improvement) return b.improvement - a.improvement;
      return b.absDelta - a.absDelta;
    });

  if (ranked.length === 0) return "pigmentation";
  if (ranked[0]!.improvement > 0) return ranked[0]!.id;
  return ranked[0]!.id;
}

function formatShortDate(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function sentenceList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function progressMetricChange(
  beforeScan: PatientProgressScan,
  afterScan: PatientProgressScan,
  key: ProgressMetricKey,
): {
  label: string;
  before: number;
  after: number;
  delta: number;
  improvement: number;
} | null {
  const before = scanMetricByKey(beforeScan, key);
  const after = scanMetricByKey(afterScan, key);
  if (!before || !after) return null;
  return {
    label: after.label || before.label,
    before: before.value,
    after: after.value,
    delta: after.value - before.value,
    improvement: before.value - after.value,
  };
}

function buildProgressCopilotChanges(
  beforeScan: PatientProgressScan,
  afterScan: PatientProgressScan,
): ProgressCopilotChange[] {
  return COMPARE_MODE_OPTIONS.map((option) => {
    const change = progressMetricChange(beforeScan, afterScan, option.id);
    if (!change) return null;
    const highlightOption = highlightOptionForIssue(
      change.label,
      option.category,
      change.label,
    );
    const regionIds = uniqueRegionIds([
      ...highlightOption.regionIds,
      ...(PROGRESS_COPILOT_REGION_FALLBACKS[option.id] ?? []),
    ]);
    return {
      id: option.id,
      label: change.label,
      before: change.before,
      after: change.after,
      delta: change.delta,
      improvement: change.improvement,
      regionIds,
      regionInsights: buildProgressRegionInsights({
        id: option.id,
        before: change.before,
        after: change.after,
        regionIds,
      }),
      narrativeLabel: PROGRESS_COPILOT_CHANGE_STORIES[option.id].label,
      narrativeDetail: PROGRESS_COPILOT_CHANGE_STORIES[option.id].detail,
    };
  })
    .filter((change): change is ProgressCopilotChange => change != null)
    .sort((a, b) => {
      const improvementSort =
        Math.max(0, b.improvement) - Math.max(0, a.improvement);
      if (improvementSort !== 0) return improvementSort;
      return Math.abs(b.delta) - Math.abs(a.delta);
    })
    .slice(0, 4);
}

type ProgressInsightConfidence = "High" | "Medium" | "Low";

function progressInsightConfidence(
  change: ProgressCopilotChange,
): ProgressInsightConfidence {
  if (change.improvement <= 2) return "Low";
  const relativeImprovement = change.improvement / Math.max(change.before, 1);
  if (change.improvement >= 15 || relativeImprovement >= 0.28) return "High";
  if (change.improvement >= 6 || relativeImprovement >= 0.12) return "Medium";
  return "Low";
}

function progressInsightConfidenceHint(
  confidence: ProgressInsightConfidence,
): string {
  if (confidence === "High") {
    return "Strong scan signal supports this improvement estimate.";
  }
  if (confidence === "Medium") {
    return "Moderate scan signal; treat this as a directional estimate.";
  }
  return "Limited scan signal; use as a rough guide only.";
}

function InsightAreasChevron() {
  return (
    <svg
      className="fmp-progress-copilot__insight-areas-chevron"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function progressInsightImprovementText(change: ProgressCopilotChange): string {
  if (change.improvement <= 0) {
    if (change.delta > 0) {
      const increase = Math.max(
        1,
        Math.round((change.delta / Math.max(change.before, 1)) * 100),
      );
      return `${increase}% increase`;
    }
    return "No measurable change";
  }
  const center = Math.max(1, Math.round(change.improvement * 0.85));
  const spread = Math.max(4, Math.round(center * 0.22));
  const low = Math.max(5, center - spread);
  const high = center + spread;
  return `${low}–${high}% improvement`;
}

function progressGoalDisplay(goal: string | undefined): string {
  const trimmed = goal?.trim();
  if (trimmed) return trimmed;
  return "look clearer, brighter, and more even-toned without looking over-treated";
}

function progressGoalStoryText(goal: string): string {
  return goal
    .replace(/^look\s+/i, "")
    .replace(
      /clearer and more even-toned with less visible dark spotting/i,
      "clearer, more even tone",
    )
    .replace(/\ban upcoming\b/i, "her")
    .replace(/\s+/g, " ")
    .trim();
}

function storyForProgressMetricLabel(
  label: string,
): (typeof PROGRESS_COPILOT_CHANGE_STORIES)[ProgressMetricKey] {
  const normalized = label.toLowerCase();
  if (normalized.includes("red"))
    return PROGRESS_COPILOT_CHANGE_STORIES.redness;
  if (normalized.includes("pore")) return PROGRESS_COPILOT_CHANGE_STORIES.pores;
  if (normalized.includes("wrinkle") || normalized.includes("line")) {
    return PROGRESS_COPILOT_CHANGE_STORIES.wrinkles;
  }
  if (normalized.includes("volume"))
    return PROGRESS_COPILOT_CHANGE_STORIES.volume;
  if (normalized.includes("structure") || normalized.includes("jaw")) {
    return PROGRESS_COPILOT_CHANGE_STORIES.structure;
  }
  return PROGRESS_COPILOT_CHANGE_STORIES.pigmentation;
}

function progressNarrativePhrase(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("red")) return "less visible redness";
  if (normalized.includes("pore")) return "smoother texture";
  if (normalized.includes("wrinkle") || normalized.includes("line")) {
    return "controlled fine lines";
  }
  if (normalized.includes("volume")) return "maintained cheek support";
  if (normalized.includes("structure") || normalized.includes("jaw")) {
    return "stable facial balance";
  }
  return "more even tone";
}

function buildLoggedTreatmentLabels(items: DiscussedItem[]): string[] {
  return items
    .filter((item) => item.treatment || item.product)
    .slice(0, 4)
    .map((item) => {
      const name = conciseTreatmentName(item).replace(/^SkinCeuticals\s+/i, "");
      const timing = item.completedAt
        ? formatShortDate(item.completedAt)
        : item.timeline
          ? item.timeline.toLowerCase() === "now"
            ? "in progress"
            : item.timeline.toLowerCase()
          : "logged";
      return `${name} · ${timing}`;
    });
}

function conciseTreatmentName(item: DiscussedItem): string {
  const product = item.product?.split("|")[0]?.trim();
  if (item.treatment === "Skincare" && product) return product;
  return product || item.treatment;
}

function buildConciseTreatmentSummary(items: DiscussedItem[]): string {
  const labels = items
    .filter((item) => item.treatment || item.product)
    .slice(0, 3)
    .map(conciseTreatmentName)
    .filter(Boolean);
  if (labels.length === 0) return "the documented plan";
  return sentenceList(labels);
}

function createDefaultProgressCopilotConfig(
  client: Pick<
    Client,
    "aestheticGoals" | "skinComplaints" | "treatmentReceived" | "discussedItems"
  > | null,
  focusMetricKey: ProgressMetricKey,
): ProgressCopilotConfig {
  const discussedItems = client?.discussedItems ?? [];
  return {
    goal:
      typeof client?.aestheticGoals === "string" ? client.aestheticGoals : "",
    skinComplaints:
      typeof client?.skinComplaints === "string" ? client.skinComplaints : "",
    previousTreatmentContext:
      typeof client?.treatmentReceived === "string"
        ? client.treatmentReceived
        : "",
    focusMetricKey,
    includedTreatmentIds: discussedItems
      .map((item) => item.id)
      .filter(Boolean),
  };
}

function progressCopilotTreatmentLabel(item: DiscussedItem): string {
  const name = conciseTreatmentName(item).replace(/^SkinCeuticals\s+/i, "");
  if (item.completedAt) {
    return `${name} · ${formatShortDate(item.completedAt)}`;
  }
  if (item.timeline) {
    const timing =
      item.timeline.toLowerCase() === "now" ? "in progress" : item.timeline;
    return `${name} · ${timing}`;
  }
  return name;
}

function normalizePatientContextText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/\s+/g, " ")
    .replace(/\.$/, "");
}

function defaultPriorExperience(metricKey: ProgressMetricKey): string {
  if (metricKey === "pigmentation") {
    return "HydraFacial, OTC vitamin C, and retinol with inconsistent daily SPF";
  }
  if (metricKey === "redness") {
    return "gentle skincare and trigger avoidance, with redness still visible in photos";
  }
  if (metricKey === "pores") {
    return "retinol and exfoliating products used inconsistently";
  }
  if (metricKey === "wrinkles") {
    return "prior neuromodulator with early return of motion";
  }
  if (metricKey === "volume") {
    return "prior filler consultation but no recent volume treatment logged";
  }
  return "prior aesthetic care, now being tracked with a baseline scan";
}

function progressProductLink(
  productNameNeedle: string,
  shortName: string,
): ProgressCopilotProductLink | undefined {
  const needle = productNameNeedle.trim().toLowerCase();
  const product = TREATMENT_BOUTIQUE_SKINCARE.find((item) =>
    item.name.toLowerCase().includes(needle),
  );
  if (!product?.productUrl) return undefined;
  return {
    name: product.name,
    shortName,
    imageUrl: product.imageUrl,
    productUrl: product.productUrl,
    price: product.price,
  };
}

function progressProductLinks(
  products: Array<[productNameNeedle: string, shortName: string]>,
): ProgressCopilotProductLink[] | undefined {
  const links = products
    .map(([needle, shortName]) => progressProductLink(needle, shortName))
    .filter((product): product is ProgressCopilotProductLink => Boolean(product));
  return links.length > 0 ? links : undefined;
}

function progressSuggestionsForMetric(
  metricKey: ProgressMetricKey,
): ProgressCopilotSuggestion[] {
  if (metricKey === "pigmentation") {
    return [
      {
        kind: "skincare",
        detail: "AM antioxidant serum plus daily SPF",
        products: progressProductLinks([
          ["SkinCeuticals C E Ferulic", "C E Ferulic"],
          ["The Treatment On The Daily SPF 45", "Daily SPF 45"],
        ]),
      },
      {
        kind: "skincare",
        detail: "PM retinoid as tolerated plus pigment serum",
        products: progressProductLinks([
          ["SkinCeuticals Retinol 0.3%", "Retinol 0.3"],
          ["SkinCeuticals Discoloration Defense", "Discoloration Defense"],
        ]),
      },
      {
        kind: "treatment",
        detail: "Consider IPL or pigment laser if cheek pigment persists",
      },
    ];
  }
  if (metricKey === "redness") {
    return [
      {
        kind: "skincare",
        detail: "Gentle cleanser, calming support, and SPF",
        products: progressProductLinks([
          ["SkinCeuticals Gentle Cleanser", "Gentle Cleanser"],
          ["SkinCeuticals Redness Neutralizer", "Redness Neutralizer"],
          ["The Treatment On The Daily SPF 45", "Daily SPF 45"],
        ]),
      },
      {
        kind: "treatment",
        detail: "Review heat, alcohol, actives, and post-peel irritation triggers",
      },
      {
        kind: "treatment",
        detail: "Consider IPL or vascular laser only if persistent redness remains",
      },
    ];
  }
  if (metricKey === "pores") {
    return [
      {
        kind: "skincare",
        detail: "PM retinoid plus BHA/AHA as tolerated",
        products: progressProductLinks([
          ["SkinCeuticals Retinol 0.3%", "Retinol 0.3"],
          ["SkinCeuticals Blemish + Age Defense", "Blemish + Age"],
        ]),
      },
      {
        kind: "treatment",
        detail: "Discuss microneedling or light resurfacing if texture stays a priority",
      },
    ];
  }
  if (metricKey === "wrinkles") {
    return [
      {
        kind: "skincare",
        detail: "Retinoid, SPF, and hydration support",
        products: progressProductLinks([
          ["SkinCeuticals Retinol 0.3%", "Retinol 0.3"],
          ["The Treatment On The Daily SPF 45", "Daily SPF 45"],
          ["SkinCeuticals Hydrating B5 Gel", "Hydrating B5"],
        ]),
      },
      {
        kind: "treatment",
        detail: "Discuss neuromodulator before full motion returns",
      },
    ];
  }
  if (metricKey === "volume") {
    return [
      {
        kind: "treatment",
        detail: "Compare cheek support and under-eye shadow in the same angle",
      },
      {
        kind: "treatment",
        detail: "Discuss HA filler or biostimulator only if support is still a goal",
      },
      {
        kind: "treatment",
        detail: "Use the next visit to decide maintenance vs observation",
      },
    ];
  }
  return [
    {
      kind: "treatment",
      detail: "Confirm profile goals before adding structure-focused treatment",
    },
    {
      kind: "treatment",
      detail: "Discuss chin, jawline, or balancing treatment only if aligned with goal",
    },
  ];
}

function progressPlanSummaryForMetric(metricKey: ProgressMetricKey): string {
  if (metricKey === "pigmentation") {
    return "Keep pigment control daily, then decide whether residual cheek pigment needs IPL or pigment laser.";
  }
  if (metricKey === "redness") {
    return "Keep the barrier plan steady, review triggers, then reserve device treatment for persistent redness.";
  }
  if (metricKey === "pores") {
    return "Keep the retinoid and exfoliation rhythm consistent before deciding on microneedling or resurfacing.";
  }
  if (metricKey === "wrinkles") {
    return "Time neuromodulator maintenance before full motion returns while the skin-care foundation stays consistent.";
  }
  if (metricKey === "volume") {
    return "Use the matched angles to decide whether cheek support is stable enough to observe or discuss filler/biostimulator.";
  }
  return "Confirm the profile goal before adding chin, jawline, or balancing treatment.";
}

function ProgressCopilotSuggestionProducts({
  products,
}: {
  products: ProgressCopilotProductLink[];
}) {
  return (
    <div className="fmp-progress-copilot__product-strip">
      {products.map((product) => (
        <a
          key={product.productUrl}
          className="fmp-progress-copilot__product-link"
          href={product.productUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Shop ${product.name}`}
        >
          {product.imageUrl ? (
            <img
              className="fmp-progress-copilot__product-thumb"
              src={product.imageUrl}
              alt=""
              loading="lazy"
            />
          ) : (
            <span
              className="fmp-progress-copilot__product-thumb fmp-progress-copilot__product-thumb--placeholder"
              aria-hidden="true"
            >
              P
            </span>
          )}
          <span className="fmp-progress-copilot__product-copy">
            <span className="fmp-progress-copilot__product-name">
              {product.shortName}
            </span>
            {product.price ? (
              <span className="fmp-progress-copilot__product-price">
                {product.price}
              </span>
            ) : null}
          </span>
        </a>
      ))}
    </div>
  );
}

function ProgressCopilotSuggestedPlanSection({
  detail,
  suggestions,
}: {
  detail: string;
  suggestions: ProgressCopilotSuggestion[];
}) {
  const [open, setOpen] = useState(false);
  const typed = useSequentialTypewriter([detail], 16, open);
  const skincare = suggestions.filter((suggestion) => suggestion.kind === "skincare");
  const treatments = suggestions.filter(
    (suggestion) => suggestion.kind === "treatment",
  );
  const detailComplete = typed[0] === detail;

  return (
    <details
      className="fmp-progress-copilot__suggested-plan"
      aria-label="Suggested plan"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="fmp-progress-copilot__insights-label fmp-progress-copilot__suggested-plan-heading">
          <span
            className="fmp-progress-copilot__insights-icon"
            aria-hidden
          />
          Suggested plan
        </span>
        <InsightAreasChevron />
      </summary>
      <div className="fmp-progress-copilot__suggested-plan-body">
        <p className="fmp-progress-copilot__suggested-plan-summary">
          {typed[0]}
          {!detailComplete ? (
            <span
              className="fmp-progress-copilot__typewriter-caret"
              aria-hidden
            />
          ) : null}
        </p>
        {skincare.length > 0 ? (
          <div className="fmp-progress-copilot__suggested-plan-group">
            <span className="fmp-progress-copilot__section-label">
              Skincare products
            </span>
            <div className="fmp-progress-copilot__recommendation-grid">
              {skincare.map((suggestion) => (
                <div
                  key={suggestion.detail}
                  className="fmp-progress-copilot__recommendation-card fmp-progress-copilot__recommendation-card--stacked"
                >
                  <div className="fmp-progress-copilot__recommendation-body">
                    <strong>{suggestion.detail}</strong>
                    {suggestion.products?.length ? (
                      <ProgressCopilotSuggestionProducts
                        products={suggestion.products}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {treatments.length > 0 ? (
          <div className="fmp-progress-copilot__suggested-plan-group">
            <span className="fmp-progress-copilot__section-label">
              Treatments
            </span>
            <div className="fmp-progress-copilot__recommendation-grid">
              {treatments.map((suggestion) => (
                <div
                  key={suggestion.detail}
                  className="fmp-progress-copilot__recommendation-card fmp-progress-copilot__recommendation-card--stacked"
                >
                  <div className="fmp-progress-copilot__recommendation-body">
                    <strong>{suggestion.detail}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function buildDetectedFindingLabels(
  beforeScan: PatientProgressScan,
  afterScan: PatientProgressScan,
): string[] {
  return afterScan.metrics
    .map((metric) => {
      const change = progressMetricChange(beforeScan, afterScan, metric.key);
      if (!change) return null;
      const direction =
        change.delta < 0
          ? `${Math.abs(change.delta)} point decrease`
          : change.delta > 0
            ? `${change.delta} point increase`
            : "no score change";
      return {
        text: `${change.label}: ${change.before} to ${change.after} (${direction})`,
        sort: Math.abs(change.delta),
      };
    })
    .filter((item): item is { text: string; sort: number } => item != null)
    .sort((a, b) => b.sort - a.sort)
    .slice(0, 4)
    .map((item) => item.text);
}

function buildProgressCopilotDraft(input: {
  patientName: string;
  patientAge?: number | null;
  goal?: string;
  skinComplaints?: string;
  previousTreatmentContext?: string | null;
  beforeScan: PatientProgressScan;
  afterScan: PatientProgressScan;
  activeMetricKey: ProgressMetricKey;
  discussedItems: DiscussedItem[];
}): ProgressCopilotDraft {
  const activeChange =
    progressMetricChange(
      input.beforeScan,
      input.afterScan,
      input.activeMetricKey,
    ) ??
    progressMetricChange(input.beforeScan, input.afterScan, "pigmentation");
  const before = activeChange?.before ?? 0;
  const after = activeChange?.after ?? 0;
  const improvement = activeChange?.improvement ?? 0;
  const metricLabel = activeChange?.label ?? "Severity";
  const allChanges = input.afterScan.metrics
    .map((metric) =>
      progressMetricChange(input.beforeScan, input.afterScan, metric.key),
    )
    .filter((change): change is NonNullable<typeof change> => change != null)
    .sort((a, b) => b.improvement - a.improvement);
  const improvedChanges = allChanges
    .filter((change) => change.improvement > 0)
    .slice(0, 3);
  const strongestChangeText =
    improvedChanges.length > 0
      ? sentenceList(
          improvedChanges.map(
            (change) =>
              `${change.label.toLowerCase()} (${change.before} to ${change.after})`,
          ),
        )
      : "stable measured findings";
  const loggedTreatments = buildLoggedTreatmentLabels(input.discussedItems);
  const groundedFindings = buildDetectedFindingLabels(
    input.beforeScan,
    input.afterScan,
  );
  const confidence: ProgressCopilotDraft["confidence"] =
    improvement >= 20 && improvedChanges.length >= 2
      ? "High"
      : improvement >= 8
        ? "Moderate"
        : "Low";
  const goalText = progressGoalDisplay(input.goal);
  const treatmentContext =
    loggedTreatments.length > 0
      ? sentenceList(loggedTreatments)
      : "no completed treatment was logged in the plan";
  const conciseTreatments = buildConciseTreatmentSummary(input.discussedItems);
  const uncertainty =
    "Scan score changes are directional and should be interpreted with the photos because lighting, expression, hair position, and crop alignment can affect exact values.";
  const changePhrase =
    improvement > 0
      ? `${improvement} point improvement`
      : improvement < 0
        ? `${Math.abs(improvement)} point increase`
        : "no measured change";
  const strongestNarrative =
    improvedChanges.length > 0
      ? sentenceList(
          improvedChanges
            .slice(0, 2)
            .map((change) => progressNarrativePhrase(change.label)),
        )
      : "stable scan findings";
  const activeStory = storyForProgressMetricLabel(metricLabel);
  const statusLabel =
    improvement > 0
      ? confidence === "High"
        ? "On track"
        : "Likely on track"
      : "Needs review";
  const primaryTakeaway =
    improvement > 0 ? activeStory.label : "Review plan fit";
  const goalStory = progressGoalStoryText(goalText);
  const compactGoalStory = goalStory
    .replace(
      /clearer, more even tone(?: with less visible dark spotting)? before her event/i,
      "clearer tone before her event",
    )
    .replace(/\s+/g, " ")
    .trim();
  const patientDescriptor =
    typeof input.patientAge === "number" && Number.isFinite(input.patientAge)
      ? `${input.patientAge}-year-old patient`
      : "patient";
  const concernsText =
    normalizePatientContextText(input.skinComplaints) ||
    "tone, texture, and early aging concerns";
  const priorExperience =
    normalizePatientContextText(input.previousTreatmentContext) ||
    defaultPriorExperience(input.activeMetricKey);
  const compactPriorExperience = priorExperience
    .replace(/over-the-counter/gi, "OTC")
    .replace(/before starting the current pigment plan/i, "before this pigment plan")
    .replace(
      /HydraFacial, OTC vitamin C, retinol, and inconsistent daily SPF before this pigment plan/i,
      "HydraFacial, OTC vitamin C/retinol, inconsistent SPF",
    )
    .replace(
      /HydraFacial, OTC vitamin C\/retinol, inconsistent SPF/i,
      "HydraFacial + OTC vitamin C/retinol, inconsistent SPF",
    )
    .replace(/\s+/g, " ")
    .trim();
  const suggestions = progressSuggestionsForMetric(input.activeMetricKey);
  const compactTreatments = conciseTreatments.replace(
    "SkinCeuticals Discoloration Defense",
    "Discoloration Defense",
  ).replace(
    /Depigmentation peel and Discoloration Defense/i,
    "peel + Discoloration Defense",
  );
  const compactScanRead = strongestNarrative.replace(
    /more even tone and less visible redness/i,
    "tone is calmer",
  );
  const compactMetricFocus =
    input.activeMetricKey === "pigmentation"
      ? "cheek pigment"
      : metricLabel.toLowerCase();
  const goalConnection =
    improvement > 0
      ? `The follow-up supports her goal of ${goalStory}. The clearest visual changes are ${strongestNarrative} in the highlighted areas.`
      : `The follow-up does not yet show a confident visual step toward ${goalStory}.`;
  const providerCue =
    improvement > 0
      ? "Use the photos to show how the plan is working, then transition to maintenance and keep the regimen consistent."
      : "Frame this as a check-in: the photos are useful, but the next plan decision should be based on adherence, timing, and whether the original goal still fits.";
  const nextBestStep =
    improvement > 0
      ? suggestions[0]?.detail ?? "Protect the result and plan maintenance timing."
      : "Good moment to reset expectations and adjust the next treatment step.";
  const patientContext = `${input.patientName} is a ${patientDescriptor} who came in wanting ${goalStory}, with concerns around ${concernsText.toLowerCase()}.`;
  const priorContext = `She had previous experience with ${priorExperience}.`;
  const treatmentJourney =
    loggedTreatments.length > 0
      ? `Since the ${input.beforeScan.dateLabel} baseline, the documented plan has included ${conciseTreatments}.`
      : `Since the ${input.beforeScan.dateLabel} baseline, this comparison is tracking the scan story without a logged treatment plan.`;
  const outcomeNarrative =
    improvement > 0
      ? `The ${input.afterScan.dateLabel} scan supports ${strongestNarrative}. Residual ${metricLabel.toLowerCase()} stays visible in the highlighted areas, so the next visit should protect the gain and decide whether the remaining change needs device support.`
      : `So far, the ${input.afterScan.dateLabel} scan does not show a clear visual step toward the goal, so the next move should start with adherence, timing, and whether the goal still matches the plan.`;
  const clinicalStory =
    improvement > 0
      ? `${patientDescriptor.replace(" patient", "")} goal: ${compactGoalStory}. Prior: ${compactPriorExperience}. Plan: ${compactTreatments}. Read: ${compactScanRead}; ${compactMetricFocus} guides next step.`
      : `${patientDescriptor.replace(" patient", "")} goal: ${compactGoalStory}. Prior: ${compactPriorExperience}. Read is not yet clearly moving toward that goal, so check adherence, timing, and plan fit before escalating.`;
  const narrative =
    improvement > 0
      ? `Compared with ${input.beforeScan.dateLabel}, the follow-up scan is directionally consistent with the patient's stated goal. The strongest support is ${strongestNarrative}, with score movement that is also visible in the highlighted facial regions.`
      : `Compared with ${input.beforeScan.dateLabel}, the follow-up scan is not showing a clear movement toward the stated goal yet.`;
  const nextDiscussion =
    improvement > 0
      ? "Start by showing the highlighted areas, then discuss maintenance timing or the next tone-focused step."
      : "Review adherence, triggers, and whether the current treatment path still matches the patient's stated goal.";

  return {
    statusLabel,
    goal: goalText,
    goalConnection,
    primaryTakeaway,
    providerCue,
    nextBestStep,
    patientContext,
    priorContext,
    treatmentJourney,
    outcomeNarrative,
    clinicalStory,
    nextStepLabel:
      improvement > 0 ? "Specific next steps" : "Recalibrate the plan",
    nextStepDetail:
      improvement > 0
        ? progressPlanSummaryForMetric(input.activeMetricKey)
        : "Review adherence and timing before adding another treatment.",
    suggestions,
    narrative,
    nextDiscussion,
    confidence,
    uncertainty,
    groundedFindings,
    loggedTreatments,
    providerNote: `Progress comparison reviewed for the patient's stated goal: ${goalText}. The ${input.afterScan.dateLabel} re-scan was compared with the ${input.beforeScan.dateLabel} baseline. Overall, the comparison supports visible progress toward the goal. ${narrative} Supporting measured changes are ${strongestChangeText}; ${metricLabel} changed from ${before} to ${after}, a ${changePhrase}. Logged treatment context: ${treatmentContext}. Confidence: ${confidence}. ${uncertainty}`,
    patientSummary: `Your follow-up scan appears to be moving in the direction of your goal: ${goalText}. Compared with your ${input.beforeScan.dateLabel} scan, the most visible improvements are ${strongestNarrative}. We will review the highlighted areas together and decide how to maintain the result or adjust the next step.`,
    chartNote: `Progress comparison reviewed: ${input.beforeScan.dateLabel} baseline vs ${input.afterScan.dateLabel} re-scan. Patient goal: ${goalText}. Narrative: ${narrative} ${metricLabel} ${before} -> ${after} (${changePhrase}). Supporting measured changes: ${strongestChangeText}. Treatment grounding: ${treatmentContext}. Confidence: ${confidence}; uncertainty noted due to scan/photo-condition variability.`,
    nextSteps:
      improvement > 0
        ? nextDiscussion
        : `${nextDiscussion} Consider adjusting treatment timing before the next intervention.`,
  };
}

/** Qualities exposed in the dashboard (draft/ultra removed — too low fidelity). */
const ENABLED_SCAN_QUALITIES: ScanQuality[] = ["standard", "high"];
const DEFAULT_SCAN_QUALITY: ScanQuality = "standard";

function normalizeScanQuality(value: string | undefined): ScanQuality {
  return value === "high" ? "high" : DEFAULT_SCAN_QUALITY;
}

const QUALITY_LABELS: Record<
  ScanQuality,
  { label: string; time: string; desc: string }
> = {
  standard: {
    label: "Standard",
    time: "~3–4 min",
    desc: "Recommended quality",
  },
  high: {
    label: "High",
    time: "~4–5 min",
    desc: "Maximum detail, longest wait",
  },
};

function uniqueRegionIds(ids: string[]): string[] {
  return [
    ...new Set(
      ids.filter((id) => ALL_MIRROR_ANNOTATION_REGION_IDS.includes(id)),
    ),
  ];
}

function subScoreNameForIssue(
  categoryKey: AuraOverviewCategoryKey,
  issueName: string,
): string | undefined {
  const issueKey = normalizeIssue(issueName);
  const category = CATEGORIES.find((cat) => cat.key === categoryKey);
  return category?.subScores.find((sub) =>
    sub.issues.some((issue) => normalizeIssue(issue) === issueKey),
  )?.name;
}

function highlightOptionForIssue(
  issueName: string,
  categoryKey: AuraOverviewCategoryKey,
  subScoreName?: string,
): FaceMirrorHighlightOption {
  const label = canonicalIssueDisplayLabel(issueName);
  const directRegionIds = [
    ...getHighlightedRegionIds([issueToMirrorHighlightTerm(label)]),
  ];
  const fallbackSubScore =
    subScoreName ?? subScoreNameForIssue(categoryKey, label);
  const fallbackRegionIds = fallbackSubScore
    ? (SUB_SCORE_MINIMAP_REGIONS[fallbackSubScore] ?? [])
    : [];
  return {
    id: `${categoryKey}:${fallbackSubScore ?? "finding"}:${normalizeIssue(label)}`,
    label,
    regionIds: uniqueRegionIds(
      directRegionIds.length > 0 ? directRegionIds : fallbackRegionIds,
    ),
  };
}

function AuraMarkerVisibilityIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.1 12S5.8 5 12 5s9.9 7 9.9 7-3.7 7-9.9 7-9.9-7-9.9-7Z" />
      <circle cx="12" cy="12" r="3" />
      {hidden ? <path d="m3 3 18 18" /> : null}
    </svg>
  );
}

type ScanState =
  | { phase: "idle" }
  | { phase: "config" }
  | { phase: "submitting" }
  | {
      phase: "running";
      jobId: string;
      progress: number;
      message: string;
      remaining: number;
    }
  | { phase: "done"; videoUrl: string }
  | { phase: "error"; message: string };

function scanPhotoSlotKey(slot: ClientPhotoSlot, index: number): string {
  return `${slot.id || "photo"}:${slot.url}:${index}`;
}

function defaultScanPhotoSelection(slots: ClientPhotoSlot[]): string[] {
  const selected = slots
    .map((slot, index) => ({ slot, key: scanPhotoSlotKey(slot, index) }))
    .filter(({ slot }) => slot.url && !isIntakeOrFormSlot(slot))
    .map(({ key }) => key);
  if (selected.length > 0) return selected;
  return slots
    .map((slot, index) => ({ slot, key: scanPhotoSlotKey(slot, index) }))
    .filter(({ slot }) => slot.url)
    .map(({ key }) => key);
}

function selectedScanPhotoSlots(
  slots: ClientPhotoSlot[],
  selectedKeys: string[],
): ClientPhotoSlot[] {
  const selected = new Set(selectedKeys);
  return slots.filter((slot, index) =>
    selected.has(scanPhotoSlotKey(slot, index)),
  );
}

function formatRemaining(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  if (total <= 0) return "still working…";
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s remaining` : `${s}s remaining`;
}

const dispatchedDoneScanCallbacks = new Set<string>();

function doneScanCallbackStorageKey(key: string): string {
  return `fmp-done-scan-callback:${key}`;
}

function hasDispatchedDoneScanCallback(key: string): boolean {
  if (dispatchedDoneScanCallbacks.has(key)) return true;
  try {
    return sessionStorage.getItem(doneScanCallbackStorageKey(key)) === "1";
  } catch {
    return false;
  }
}

function markDoneScanCallbackDispatched(key: string): void {
  dispatchedDoneScanCallbacks.add(key);
  try {
    sessionStorage.setItem(doneScanCallbackStorageKey(key), "1");
  } catch {
    /* ignore storage failures */
  }
}

// ---------------------------------------------------------------------------
// Helpers copied from original FaceMirrorPanel
// ---------------------------------------------------------------------------
type ViewMode = "photo" | "3d";

function isIntakeOrFormSlot(s: ClientPhotoSlot): boolean {
  const id = s.id.toLowerCase();
  const lab = (s.label ?? "").toLowerCase();
  return id.includes("form") || lab.includes("intake");
}

function simplifyToFrontSideSlots(slots: ClientPhotoSlot[]): ClientPhotoSlot[] {
  if (slots.length === 0) return [];
  if (slots.length === 1) return [{ ...slots[0], label: "Front" }];
  const lower = (s: string) => s.toLowerCase();

  const front =
    slots.find((s) => lower(s.id) === "front") ??
    slots.find(
      (s) =>
        !isIntakeOrFormSlot(s) &&
        (lower(s.id).includes("front") ||
          (s.label && lower(s.label).includes("front"))),
    ) ??
    slots.find((s) => lower(s.id).includes("front")) ??
    slots[0];

  const others = slots.filter((s) => s.url !== front.url);
  if (others.length === 0) return [{ ...front, label: "Front" }];

  const sideNonIntake =
    others.find((s) => lower(s.id) === "side") ??
    others.find((s) => {
      if (isIntakeOrFormSlot(s)) return false;
      if (lower(s.id).includes("front")) return false;
      const blob = lower(`${s.id} ${s.label ?? ""}`);
      return /(\bleft\b|\bright\b|profile|\b45\b|\b90\b|side)/.test(blob);
    });

  const side =
    sideNonIntake ??
    others.find((s) => lower(s.id).startsWith("side")) ??
    others[0];
  return [
    { ...front, label: "Front" },
    { ...side, label: "Side" },
  ];
}

// ---------------------------------------------------------------------------
// Photo stage sub-component (unchanged from original)
// ---------------------------------------------------------------------------
function FaceMirrorPhotoStage({
  activePhotoUrl,
  patientName,
  highlightTerms,
  highlightedRegionIds,
  showAnnotations,
  wrapClassName,
}: {
  activePhotoUrl: string;
  patientName: string;
  highlightTerms: string[];
  highlightedRegionIds: string[];
  showAnnotations: boolean;
  wrapClassName?: string;
}) {
  return (
    <div
      className={
        wrapClassName ? `fmp-photo-stage ${wrapClassName}` : "fmp-photo-stage"
      }
    >
      <AiMirrorCanvas
        imageUrl={activePhotoUrl}
        alt={`${patientName} facial analysis`}
        highlightTerms={highlightTerms}
        highlightedRegionIds={highlightedRegionIds}
        showAnnotations={showAnnotations}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overlay controls (auto-rotate, highlight) on photo / 3D viewport
// ---------------------------------------------------------------------------
function FaceMirrorViewportShell({ children }: { children: ReactNode }) {
  return <div className="fmp-viewport">{children}</div>;
}

// ---------------------------------------------------------------------------
// Scan generation config panel
// ---------------------------------------------------------------------------
function ScanConfigPanel({
  slots,
  selectedPhotoKeys,
  onSelectedPhotoKeysChange,
  quality,
  onQualityChange,
  onStart,
  onCancel,
  submitting,
  client,
  patientName,
  isRegeneration = false,
}: {
  slots: ClientPhotoSlot[];
  selectedPhotoKeys: string[];
  onSelectedPhotoKeysChange: (keys: string[]) => void;
  quality: ScanQuality;
  onQualityChange: (q: ScanQuality) => void;
  onStart: () => void;
  onCancel: () => void;
  submitting: boolean;
  client?: Client | null;
  patientName: string;
  isRegeneration?: boolean;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const selectedSlots = selectedScanPhotoSlots(slots, selectedPhotoKeys);
  const photoMap = mapSlotsToModalPhotos(selectedSlots);
  const photoCount = Object.keys(photoMap).length;
  const selectedCount = selectedSlots.length;
  const togglePhoto = (key: string) => {
    onSelectedPhotoKeysChange(
      selectedPhotoKeys.includes(key)
        ? selectedPhotoKeys.filter((current) => current !== key)
        : [...selectedPhotoKeys, key],
    );
  };
  const selectAllPhotos = () => {
    onSelectedPhotoKeysChange(defaultScanPhotoSelection(slots));
  };
  const actionLabel = isRegeneration
    ? "Regenerate Analysis"
    : "Upgrade Analysis";
  const actionSubtitle = isRegeneration
    ? "Refresh 3D reconstruction and severity scoring"
    : "3D reconstruction and severity scoring";
  const runLabel = isRegeneration ? "Run Regeneration" : "Run Upgrade";

  return (
    <div
      className="fmp-upgrade-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={actionLabel}
    >
      <div className="fmp-upgrade-modal-shell">
        <button
          type="button"
          className="fmp-upgrade-modal-close"
          onClick={onCancel}
          aria-label={`Close ${actionLabel.toLowerCase()}`}
          disabled={submitting}
        >
          ×
        </button>

        <div className="fmp-scan-config">
          <div className="fmp-scan-config-header">
            <span
              className="fmp-upgrade-sparkle fmp-upgrade-sparkle--heading"
              aria-hidden
            />
            <div className="fmp-scan-config-heading-copy">
              <span>{actionLabel}</span>
              <small>{actionSubtitle}</small>
            </div>
          </div>

          <section className="fmp-upgrade-client-card">
            <span className="fmp-upgrade-client-card__label">
              Client details
            </span>
            <strong>{client?.name || patientName}</strong>
            <div className="fmp-upgrade-client-card__meta">
              {client?.email ? <span>{client.email}</span> : null}
              {client?.phone ? <span>{client.phone}</span> : null}
              {client?.tableSource ? <span>{client.tableSource}</span> : null}
            </div>
          </section>

          <div className="fmp-scan-config-row fmp-scan-config-row--stacked">
            <div className="fmp-scan-config-row-head">
              <span className="fmp-scan-config-label">Photos</span>
              <button
                type="button"
                className="fmp-upgrade-select-all"
                onClick={selectAllPhotos}
                disabled={submitting}
              >
                Select recommended
              </button>
            </div>
            <div className="fmp-upgrade-photo-grid">
              {slots.map((slot, index) => {
                const key = scanPhotoSlotKey(slot, index);
                const selected = selectedPhotoKeys.includes(key);
                return (
                  <button
                    type="button"
                    key={key}
                    className={`fmp-upgrade-photo-card${selected ? " fmp-upgrade-photo-card--selected" : ""}`}
                    onClick={() => togglePhoto(key)}
                    aria-pressed={selected}
                    disabled={submitting}
                  >
                    <span className="fmp-upgrade-photo-card__check" aria-hidden>
                      {selected ? "✓" : ""}
                    </span>
                    <img src={slot.url} alt="" draggable={false} />
                    <span className="fmp-upgrade-photo-card__label">
                      {slot.label || slot.id || `Photo ${index + 1}`}
                    </span>
                  </button>
                );
              })}
            </div>
            <span className="fmp-scan-config-value">
              {selectedCount} file{selectedCount !== 1 ? "s" : ""} selected
              {photoCount > 0 ? ` · ${Object.keys(photoMap).join(", ")}` : ""}
            </span>
          </div>

          <div className="fmp-scan-config-row fmp-scan-config-row--stacked">
            <span className="fmp-scan-config-label">Quality</span>
            <div className="fmp-scan-quality-options">
              {ENABLED_SCAN_QUALITIES.map((q) => (
                <label
                  key={q}
                  className={`fmp-scan-quality-option${quality === q ? " fmp-scan-quality-option--active" : ""}`}
                >
                  <input
                    type="radio"
                    name="scan-quality"
                    value={q}
                    checked={quality === q}
                    onChange={() => onQualityChange(q)}
                    disabled={submitting}
                  />
                  <span className="fmp-scan-quality-name">
                    {QUALITY_LABELS[q].label}
                  </span>
                  <span className="fmp-scan-quality-time">
                    {QUALITY_LABELS[q].time}
                  </span>
                  <span className="fmp-scan-quality-desc">
                    {QUALITY_LABELS[q].desc}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="fmp-scan-config-actions">
            <button
              type="button"
              className="fmp-scan-cancel-btn"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="fmp-scan-start-btn"
              onClick={onStart}
              disabled={submitting || photoCount === 0}
            >
              {submitting ? (
                "Submitting…"
              ) : (
                <>
                  <span
                    className="fmp-upgrade-sparkle fmp-upgrade-sparkle--button"
                    aria-hidden
                  />
                  <span className="fmp-scan-start-btn__label">{runLabel}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FaceMirrorPanel — main component
// ---------------------------------------------------------------------------
interface FaceMirrorPanelProps {
  photoUrl: string | null;
  photoSlots?: ClientPhotoSlot[];
  glbUrl?: string | null;
  highlightTerms?: string[];
  patientName?: string;
  /** Airtable record ID — used to persist the generated turntable URL back to Airtable via /api/scan/save-video. */
  airtableRecordId?: string;
  /** Airtable table name for the patient record (e.g. "Patients"). */
  airtableTableName?: string;
  onOpenPatientPhotos?: (initialTab: "front" | "side") => void;
  showPatientPhotoGallery?: boolean;
  analysisOverviewClient?: Client | null;
  analysisOverviewOnAddToPlanDirect?: (
    prefill: TreatmentPlanPrefill,
    options?: TreatmentPlanAddDirectOptions,
  ) => Promise<void | DiscussedItem> | DiscussedItem | void;
  analysisOverviewOnOpenTreatmentRecommender?: (
    issue?: string,
    category?: AuraOverviewCategoryKey,
  ) => void;
  onOpenPlanBuilder?: () => void;
  darkMode?: boolean;
  /** Fires whenever the Aura analysis tab (Skin / Volume / Structure) changes. */
  onAuraActiveCategoryChange?: (category: AuraOverviewCategoryKey) => void;
  /** Notifies parent when the full-screen analysis split opens or closes. */
  onViewportExpandedChange?: (expanded: boolean) => void;
  /** Called when a new turntable video has been generated for this client. */
  onScanGenerated?: (result: {
    videoUrl: string;
    auraAssets?: PatientAuraAssetManifest;
  }) => void;
  auraManifestUrl?: string | null;
  auraGcsPrefix?: string | null;
  initialAuraManifest?: PatientAuraAssetManifest | null;
  allowCachedAuraManifest?: boolean;
}

export default function FaceMirrorPanel({
  photoUrl,
  photoSlots = [],
  glbUrl: videoUrlProp,
  highlightTerms = [],
  patientName = "Patient",
  airtableRecordId,
  airtableTableName,
  onOpenPatientPhotos,
  showPatientPhotoGallery = false,
  analysisOverviewClient = null,
  analysisOverviewOnAddToPlanDirect,
  analysisOverviewOnOpenTreatmentRecommender,
  onOpenPlanBuilder,
  onAuraActiveCategoryChange,
  onViewportExpandedChange,
  onScanGenerated,
  auraManifestUrl,
  auraGcsPrefix,
  initialAuraManifest,
  allowCachedAuraManifest = true,
}: FaceMirrorPanelProps) {
  // --- Existing state ---
  const [mode, setMode] = useState<ViewMode>(() =>
    clientUsesAuraScan(patientName) && Boolean(videoUrlProp?.trim())
      ? "3d"
      : "photo",
  );
  const [autoRotate3d, setAutoRotate3d] = useState(false);
  const highlightStorageKey = faceMirrorHighlightStorageKey(
    airtableRecordId,
    patientName,
  );
  const [manualHighlightedRegionIds, setManualHighlightedRegionIds] = useState<
    string[]
  >(() =>
    loadFaceMirrorHighlightedRegions(
      highlightStorageKey,
      ALL_MIRROR_ANNOTATION_REGION_IDS,
    ),
  );
  const [angleIdx, setAngleIdx] = useState(0);
  const [viewportExpanded, setViewportExpanded] = useState(false);
  const [auraPanelCollapsed, setAuraPanelCollapsed] = useState(false);
  const [auraAnnotationsHidden, setAuraAnnotationsHidden] = useState(false);
  const [auraActiveCategory, setAuraActiveCategory] =
    useState<AuraOverviewCategoryKey>("skinHealth");
  const [auraActiveSkinLens, setAuraActiveSkinLens] =
    useState<AuraSkinLens>("pigmentation");
  const [auraActiveAnalysisArea, setAuraActiveAnalysisArea] = useState<string>(
    AURA_ANALYSIS_AREA_ALL,
  );
  const [compareScans, setCompareScans] = useState<
    PatientProgressScan[] | null
  >(null);
  const [selectedPreviewScanId, setSelectedPreviewScanId] = useState<
    string | null
  >(null);
  const [compareViewAngle, setCompareViewAngle] = useState<ViewAngle>("front");
  const [compareZoomLocked, setCompareZoomLocked] = useState(false);
  const [compareAnnotateActive, setCompareAnnotateActive] = useState(false);
  const [compareAnnotateStrokes, setCompareAnnotateStrokes] = useState<AnnotateStroke[]>([]);
  const [compareAnnotateSaveStatus, setCompareAnnotateSaveStatus] = useState<
    "idle" | "saving" | "saved" | "failed"
  >("idle");
  const compareTransformReportsRef = useRef<[ViewportTransform, ViewportTransform]>(
    [defaultCompareViewportTransform(), defaultCompareViewportTransform()],
  );
  const compareViewportApisRef = useRef<
    [CompareViewportPaneApi | null, CompareViewportPaneApi | null]
  >([null, null]);
  /** When locked, stores the pair of transforms at the moment a delta was last applied. */
  const compareLinkedTransformsRef = useRef<
    [ViewportTransform, ViewportTransform] | null
  >(null);
  const compareZoomLockedRef = useRef(false);
  compareZoomLockedRef.current = compareZoomLocked;
  const [progressCopilotDraft, setProgressCopilotDraft] =
    useState<ProgressCopilotDraft | null>(null);
  const [progressCopilotConfig, setProgressCopilotConfig] =
    useState<ProgressCopilotConfig | null>(null);
  const [progressCopilotOpen, setProgressCopilotOpen] = useState(false);
  const compareCopilotSessionRef = useRef<string | null>(null);
  const [activeProgressChangeId, setActiveProgressChangeId] =
    useState<ProgressMetricKey | null>(null);
  const [activeProgressRegionId, setActiveProgressRegionId] = useState<
    string | null
  >(null);
  const [annotateStrokes, setAnnotateStrokes] = useState<AnnotateStroke[]>([]);
  const [annotationsRefreshKey, setAnnotationsRefreshKey] = useState(0);
  const [adaptConfigOpen, setAdaptConfigOpen] = useState(false);
  // --- Scan generation state ---
  const [scanState, setScanState] = useState<ScanState>({ phase: "idle" });
  const [scanQuality, setScanQuality] =
    useState<ScanQuality>(DEFAULT_SCAN_QUALITY);
  const [selectedScanPhotoKeys, setSelectedScanPhotoKeys] = useState<string[]>(
    [],
  );
  const [overrideGlbUrl, setOverrideGlbUrl] = useState<string | null>(null);
  const onScanGeneratedRef = useRef(onScanGenerated);

  useEffect(() => {
    if (!progressCopilotOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProgressCopilotOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [progressCopilotOpen]);

  const handleOpenEmbeddedTreatmentRecommender = useCallback(
    (issue?: string) => {
      if (issue) {
        analysisOverviewOnOpenTreatmentRecommender?.(issue);
        return;
      }
      if (analysisOverviewOnOpenTreatmentRecommender) {
        analysisOverviewOnOpenTreatmentRecommender();
        return;
      }
      onOpenPlanBuilder?.();
    },
    [analysisOverviewOnOpenTreatmentRecommender, onOpenPlanBuilder],
  );
  const [patientAuraManifest, setPatientAuraManifestState] =
    useState<PatientAuraAssetManifest | null>(
      () =>
        initialAuraManifest ??
        (allowCachedAuraManifest ? getPatientAuraManifest(patientName) : null),
    );
  // Synchronously reset manifest when patient changes — prevents stale images on first render.
  const [manifestPatientName, setManifestPatientName] = useState(patientName);
  if (manifestPatientName !== patientName) {
    setManifestPatientName(patientName);
    setPatientAuraManifestState(
      initialAuraManifest ??
        (allowCachedAuraManifest ? getPatientAuraManifest(patientName) : null),
    );
  }
  const [photoFacingByUrl, setPhotoFacingByUrl] =
    useState<AuraPhotoFacingByUrl>({});
  const previewVideoUrlRef = useRef<string | null>(null);
  const appliedDoneScanKeyRef = useRef<string | null>(null);
  const scanRecordId = useMemo(
    () => airtableRecordId?.trim() || patientName.trim(),
    [airtableRecordId, patientName],
  );

  useEffect(() => {
    onScanGeneratedRef.current = onScanGenerated;
  }, [onScanGenerated]);

  useEffect(() => {
    appliedDoneScanKeyRef.current = null;
    setOverrideGlbUrl(null);
    previewVideoUrlRef.current = null;
  }, [scanRecordId]);

  const applyPreviewVideo = useCallback((videoUrl: string) => {
    if (previewVideoUrlRef.current === videoUrl) return;
    previewVideoUrlRef.current = videoUrl;
    setOverrideGlbUrl(videoUrl);
    setMode("3d");
    // Don't expand the viewport here — the progress bar and the AuraFaceView
    // topbar would overlap. Expansion happens when the scan fully completes.
    const preload = document.createElement("video");
    preload.preload = "auto";
    preload.src = videoUrl;
  }, []);

  useEffect(() => {
    setPatientAuraManifestState(
      initialAuraManifest ??
        (allowCachedAuraManifest ? getPatientAuraManifest(patientName) : null),
    );
  }, [patientName, initialAuraManifest, allowCachedAuraManifest]);

  useEffect(() => {
    const onAuraAssetsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ clientName?: string }>).detail;
      if (detail?.clientName === patientName.trim()) {
        setPatientAuraManifestState(
          allowCachedAuraManifest ? getPatientAuraManifest(patientName) : null,
        );
      }
    };
    window.addEventListener("patient-aura-assets-changed", onAuraAssetsChanged);
    return () =>
      window.removeEventListener(
        "patient-aura-assets-changed",
        onAuraAssetsChanged,
      );
  }, [patientName, allowCachedAuraManifest]);

  const effectiveVideoUrl = overrideGlbUrl ?? videoUrlProp ?? null;
  const has3D = Boolean(effectiveVideoUrl);
  const hasGalleryPhotos = photoSlots.length > 0 || Boolean(photoUrl?.trim());
  const useAuraScan = clientUsesAuraInterface(effectiveVideoUrl);
  // Also activate the Aura UI when the patient has a pre-generated manifest
  // with angle photos (e.g. photos-only patient before the turntable is ready).
  const hasAuraManifestPhotos = Boolean(
    patientAuraManifest?.angles &&
    Object.keys(patientAuraManifest.angles).length > 0,
  );
  const useAuraView = useAuraScan || hasAuraManifestPhotos || hasGalleryPhotos;
  const patientGeneratedAura = useAuraView && !clientUsesAuraScan(patientName);

  useEffect(() => {
    if (clientUsesAuraScan(patientName)) return;
    // Always refetch when a manifest URL is known so localStorage cannot hide new wrinkle assets.
    const hasAuraAssetLink = Boolean(
      auraManifestUrl?.trim() || auraGcsPrefix?.trim(),
    );
    if (!effectiveVideoUrl && !hasAuraAssetLink) return;
    let cancelled = false;
    void (async () => {
      const manifest = await resolvePatientAuraManifest({
        clientName: patientName,
        turntableVideoUrl: effectiveVideoUrl,
        auraManifestUrl,
        auraGcsPrefix,
        probeWhenNoTurntable: hasAuraAssetLink,
      });
      if (!cancelled && manifest) {
        setPatientAuraManifestState(manifest);
        if (!videoUrlProp && manifest.turntableVideoUrl) {
          setOverrideGlbUrl(manifest.turntableVideoUrl);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    patientName,
    effectiveVideoUrl,
    videoUrlProp,
    auraManifestUrl,
    auraGcsPrefix,
    photoSlots.length,
    photoUrl,
  ]);

  useEffect(() => {
    setManualHighlightedRegionIds(
      loadFaceMirrorHighlightedRegions(
        highlightStorageKey,
        ALL_MIRROR_ANNOTATION_REGION_IDS,
      ),
    );
  }, [highlightStorageKey]);

  useEffect(() => {
    saveFaceMirrorHighlightedRegions(
      highlightStorageKey,
      manualHighlightedRegionIds,
    );
  }, [highlightStorageKey, manualHighlightedRegionIds]);

  useEffect(() => {
    onAuraActiveCategoryChange?.(auraActiveCategory);
  }, [auraActiveCategory, onAuraActiveCategoryChange]);

  const useAuraExpandedAnalysis = Boolean(
    viewportExpanded && analysisOverviewClient,
  );

  useEffect(() => {
    if (!useAuraExpandedAnalysis) setAuraAnnotationsHidden(false);
  }, [useAuraExpandedAnalysis]);

  /**
   * Collapsed split: manual regions only (no bulk interested-issues overlay).
   * Expanded Aura view: the region picker owns face highlights.
   * Non-Aura expanded view: parent highlight terms still render.
   */
  const highlightTermsForView = useMemo(() => {
    if (useAuraExpandedAnalysis) return [];
    if (viewportExpanded) return highlightTerms;
    return highlightTerms.length === 1 ? highlightTerms : [];
  }, [useAuraExpandedAnalysis, viewportExpanded, highlightTerms]);

  /** Manual region picker (photo + 3D + Aura) in split and expanded views. */
  const manualRegionsForView = manualHighlightedRegionIds;
  const annotationsHiddenForView =
    useAuraExpandedAnalysis && auraAnnotationsHidden;
  const visibleHighlightTermsForView = useMemo(
    () => (annotationsHiddenForView ? [] : highlightTermsForView),
    [annotationsHiddenForView, highlightTermsForView],
  );
  const visibleManualRegionsForView = useMemo(
    () => (annotationsHiddenForView ? [] : manualRegionsForView),
    [annotationsHiddenForView, manualRegionsForView],
  );

  const hasAnnotations = useMemo(
    () =>
      hasMirrorAnnotationHighlights(
        visibleHighlightTermsForView,
        visibleManualRegionsForView,
      ),
    [visibleHighlightTermsForView, visibleManualRegionsForView],
  );

  const handleSaveAnnotation = useCallback(
    (payload: AnnotateSavePayload) => {
      const clientId = analysisOverviewClient?.id;
      if (!clientId) return;
      const stamp = new Date().toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      savePatientAnnotation({
        clientId,
        label: `${payload.viewContext} · ${stamp}`,
        viewContext: payload.viewContext,
        strokes: payload.strokes,
        faceImageUrl: payload.faceImageUrl,
        compositeDataUrl: payload.compositeDataUrl,
      });
      setAnnotationsRefreshKey((k) => k + 1);
      window.dispatchEvent(
        new CustomEvent("patient-annotations-changed", {
          detail: { clientId },
        }),
      );
    },
    [analysisOverviewClient?.id],
  );

  const compareViewersRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (compareAnnotateSaveStatus === "idle") return undefined;
    const timer = window.setTimeout(() => setCompareAnnotateSaveStatus("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [compareAnnotateSaveStatus]);

  const compareAnnotateSaveLabel =
    compareAnnotateSaveStatus === "saving"
      ? "Saving"
      : compareAnnotateSaveStatus === "saved"
        ? "Saved"
        : compareAnnotateSaveStatus === "failed"
          ? "Failed"
          : "Save";

  const handleCompareAnnotateDownload = useCallback(async () => {
    const viewersEl = compareViewersRef.current;
    if (!viewersEl) return;
    const dataUrl = await compositeCompareAnnotation(viewersEl, compareAnnotateStrokes);
    if (!dataUrl) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadDataUrl(dataUrl, `${sanitizeDownloadFilename("compare-annotation")}-${stamp}.jpg`);
  }, [compareAnnotateStrokes]);

  const handleCompareAnnotateSave = useCallback(async () => {
    if (!analysisOverviewClient) return;
    const viewersEl = compareViewersRef.current;
    if (!viewersEl) return;
    setCompareAnnotateSaveStatus("saving");
    try {
      const dataUrl = await compositeCompareAnnotation(viewersEl, compareAnnotateStrokes);
      if (!dataUrl) {
        setCompareAnnotateSaveStatus("failed");
        return;
      }
      const stamp = new Date().toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      handleSaveAnnotation({
        faceImageUrl: dataUrl,
        compositeDataUrl: dataUrl,
        strokes: compareAnnotateStrokes,
        viewContext: `Compare · ${stamp}`,
      });
      setCompareAnnotateSaveStatus("saved");
    } catch {
      setCompareAnnotateSaveStatus("failed");
    }
  }, [analysisOverviewClient, compareAnnotateStrokes, handleSaveAnnotation]);

  const handleLoadAnnotation = useCallback((record: SavedPatientAnnotation) => {
    setAnnotateStrokes(record.strokes);
  }, []);

  useEffect(() => {
    const clientId = analysisOverviewClient?.id;
    if (!clientId) return undefined;
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ clientId?: string }>).detail;
      if (detail?.clientId && detail.clientId !== clientId) return;
      setAnnotationsRefreshKey((k) => k + 1);
    };
    const onLoadRequest = (e: Event) => {
      const detail = (
        e as CustomEvent<{ clientId: string; record: SavedPatientAnnotation }>
      ).detail;
      if (!detail || detail.clientId !== clientId) return;
      handleLoadAnnotation(detail.record);
      setViewportExpanded(true);
    };
    window.addEventListener("patient-annotations-changed", onChanged);
    window.addEventListener("patient-annotation-load-request", onLoadRequest);
    return () => {
      window.removeEventListener("patient-annotations-changed", onChanged);
      window.removeEventListener(
        "patient-annotation-load-request",
        onLoadRequest,
      );
    };
  }, [analysisOverviewClient?.id, handleLoadAnnotation]);

  const angleSlots = useMemo((): ClientPhotoSlot[] => {
    if (photoSlots.length > 0) return photoSlots;
    if (photoUrl) return [{ id: "front", label: "Front", url: photoUrl }];
    return [];
  }, [photoSlots, photoUrl]);

  const latestProgressScanAuraManifest = useMemo(() => {
    if (!analysisOverviewClient) return null;
    const records =
      analysisOverviewClient.progressScans ??
      analysisOverviewClient.facialAnalysisScans ??
      [];
    if (records.length === 0) return null;
    const sorted = [...records].sort((a, b) => {
      const left =
        a.dateIso ?? a.scannedAt ?? a.date ?? a.createdAt ?? "";
      const right =
        b.dateIso ?? b.scannedAt ?? b.date ?? b.createdAt ?? "";
      return left.localeCompare(right);
    });
    return sorted[sorted.length - 1]?.auraManifest ?? null;
  }, [analysisOverviewClient]);

  const effectivePatientAuraManifest = useMemo(
    () =>
      pickPreferredPatientAuraManifest(
        latestProgressScanAuraManifest,
        patientAuraManifest,
      ),
    [latestProgressScanAuraManifest, patientAuraManifest],
  );

  const patientProgressScans = useMemo(() => {
    if (!analysisOverviewClient) return [];
    return buildPatientProgressScans({
      client: analysisOverviewClient,
      photoSlots: angleSlots,
      turntableVideoUrl: effectiveVideoUrl,
      auraManifest: patientAuraManifest,
    });
  }, [
    analysisOverviewClient,
    angleSlots,
    effectiveVideoUrl,
    patientAuraManifest,
  ]);

  const selectedPreviewScan = useMemo(() => {
    if (patientProgressScans.length === 0) return null;
    if (selectedPreviewScanId) {
      return (
        patientProgressScans.find((scan) => scan.id === selectedPreviewScanId) ??
        patientProgressScans[patientProgressScans.length - 1]
      );
    }
    return patientProgressScans[patientProgressScans.length - 1];
  }, [patientProgressScans, selectedPreviewScanId]);

  const syncAuraViewToSelectedScan = Boolean(
    viewportExpanded && analysisOverviewClient && !compareScans,
  );

  const auraDisplayAngleSlots = useMemo((): ClientPhotoSlot[] => {
    if (
      syncAuraViewToSelectedScan &&
      selectedPreviewScan?.photoSlots &&
      selectedPreviewScan.photoSlots.length > 0
    ) {
      return selectedPreviewScan.photoSlots;
    }
    return angleSlots;
  }, [syncAuraViewToSelectedScan, selectedPreviewScan, angleSlots]);

  const auraDisplayManifest = useMemo(
    () =>
      syncAuraViewToSelectedScan
        ? pickPreferredPatientAuraManifest(
            selectedPreviewScan?.auraManifest,
            patientAuraManifest,
          )
        : effectivePatientAuraManifest,
    [
      syncAuraViewToSelectedScan,
      selectedPreviewScan,
      patientAuraManifest,
      effectivePatientAuraManifest,
    ],
  );

  const auraDisplayVideoUrl =
    syncAuraViewToSelectedScan && selectedPreviewScan?.turntableVideoUrl
      ? selectedPreviewScan.turntableVideoUrl
      : effectiveVideoUrl;

  useEffect(() => {
    setSelectedPreviewScanId(null);
  }, [analysisOverviewClient?.id]);

  const facingDetectionUrls = useMemo(
    () =>
      collectFacingDetectionUrls(
        auraDisplayAngleSlots,
        auraDisplayManifest?.angles,
      ),
    [auraDisplayAngleSlots, auraDisplayManifest],
  );
  const facingDetectionKey = useMemo(
    () => facingDetectionUrls.join("|"),
    [facingDetectionUrls],
  );

  useEffect(() => {
    if (clientUsesAuraScan(patientName)) return;
    if (facingDetectionUrls.length === 0) {
      setPhotoFacingByUrl({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        facingDetectionUrls.map(
          async (url) => [url, await detectPhotoFacingDirection(url)] as const,
        ),
      );
      if (cancelled) return;
      setPhotoFacingByUrl(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [patientName, facingDetectionKey, facingDetectionUrls]);

  useEffect(() => {
    setSelectedScanPhotoKeys(defaultScanPhotoSelection(angleSlots));
  }, [angleSlots]);

  const viewerAngleAssets = useMemo(() => {
    if (clientUsesAuraScan(patientName)) return TANYA_TAN_VIEWER_ANGLE_ASSETS;
    const slotAssets = buildViewerAngleAssetsFromPhotoSlots(auraDisplayAngleSlots);
    if (!auraDisplayManifest?.angles) {
      return alignViewerAngleAssetsByFacing(slotAssets, photoFacingByUrl);
    }

    const fallback = auraDisplayAngleSlots.find((s) => s.url)?.url ?? "";
    const assets = buildViewerAngleAssetsFromManifest(
      auraDisplayManifest,
      fallback,
    );
    const photoBackedAngles = new Set(
      inferAvailableViewAnglesFromPhotoSlots(auraDisplayAngleSlots),
    );
    const avail = getAvailableViewAngles(
      auraDisplayManifest,
      auraDisplayAngleSlots,
    );
    for (const angle of avail ?? []) {
      const slotSrc = slotAssets[angle]?.src;
      if (!slotSrc) continue;
      const manifestAngle = auraDisplayManifest.angles[angle];
      const hasGeneratedManifestStill =
        hasGeneratedAuraStillAssets(assets[angle]) ||
        hasGeneratedAuraStillAssets(manifestAngle);
      if (photoBackedAngles.has(angle)) {
        const generatedBaseSrc =
          assets[angle]?.srcCutout ??
          (hasGeneratedManifestStill ? assets[angle]?.src : undefined);
        const displaySrc = generatedBaseSrc ?? slotSrc;
        assets[angle] = {
          ...assets[angle],
          src: displaySrc,
          srcCutout: assets[angle]?.srcCutout ?? generatedBaseSrc,
          srcTexture: assets[angle]?.srcTexture ?? displaySrc,
          srcPigmentation: assets[angle]?.srcPigmentation ?? displaySrc,
          srcRedness: assets[angle]?.srcRedness,
          srcPores: assets[angle]?.srcPores,
          srcWrinkles: assets[angle]?.srcWrinkles,
          srcWrinklesView: assets[angle]?.srcWrinklesView,
        };
        continue;
      }
      if (manifestAngle?.fromPhoto || hasGeneratedManifestStill) continue;
      if (manifestAngle?.src && manifestAngle.src !== fallback) continue;
      assets[angle] = {
        ...assets[angle],
        src: slotSrc,
        srcTexture: assets[angle].srcTexture ?? slotSrc,
      };
    }
    return alignViewerAngleAssetsByFacing(assets, photoFacingByUrl);
  }, [
    patientName,
    auraDisplayAngleSlots,
    auraDisplayManifest,
    photoFacingByUrl,
  ]);

  const uploadedPhotoViewerAngleAssets = useMemo(
    () =>
      alignViewerAngleAssetsByFacing(
        buildViewerAngleAssetsFromPhotoSlots(angleSlots),
        photoFacingByUrl,
      ),
    [angleSlots, photoFacingByUrl],
  );

  const availableViewAngles = useMemo(() => {
    if (clientUsesAuraScan(patientName)) return undefined;
    const manifestAngles = getAvailableViewAngles(auraDisplayManifest, []);
    const photoAngles = alignAvailableViewAnglesByFacing(
      inferAvailableViewAnglesFromPhotoSlots(auraDisplayAngleSlots),
      auraDisplayAngleSlots,
      photoFacingByUrl,
    );
    const merged = new Set([...(manifestAngles ?? []), ...(photoAngles ?? [])]);
    const ordered = TANYA_TAN_LEFT_NAV_ORDER.filter((angle) =>
      merged.has(angle),
    );
    return ordered.length > 0 ? ordered : undefined;
  }, [patientName, auraDisplayManifest, auraDisplayAngleSlots, photoFacingByUrl]);

  const auraPhotoOnlyPreview = useAuraView && !useAuraExpandedAnalysis;

  const auraPhotoOnlyViewerAngleAssets =
    auraPhotoOnlyPreview && auraDisplayManifest?.angles
      ? viewerAngleAssets
      : uploadedPhotoViewerAngleAssets;

  const uploadedPhotoAvailableViewAngles = useMemo(() => {
    if (!auraPhotoOnlyPreview) return undefined;
    const inferred =
      alignAvailableViewAnglesByFacing(
        inferAvailableViewAnglesFromPhotoSlots(angleSlots),
        angleSlots,
        photoFacingByUrl,
      ) ?? inferAvailableViewAnglesFromPhotoSlots(angleSlots);
    const angles: (typeof inferred)[number][] = [];
    if (inferred.includes("front")) angles.push("front");
    for (const angle of inferred) {
      if (angle !== "front") angles.push(angle);
    }
    return angles.length > 0 ? angles : (["front"] as typeof inferred);
  }, [auraPhotoOnlyPreview, angleSlots, photoFacingByUrl]);

  const auraPhotoOnlyAvailableViewAngles = auraDisplayManifest?.angles
    ? availableViewAngles
    : uploadedPhotoAvailableViewAngles;

  const simplifiedSlots = useMemo(
    () => simplifyToFrontSideSlots(angleSlots),
    [angleSlots],
  );

  const slotKey = useMemo(
    () => simplifiedSlots.map((s) => `${s.id}:${s.url}`).join("|"),
    [simplifiedSlots],
  );

  useEffect(() => {
    setAngleIdx(0);
  }, [slotKey]);

  useEffect(() => {
    if (useAuraView && has3D) setMode("3d");
  }, [useAuraView, has3D, patientName]);

  const activePhotoUrl = simplifiedSlots[angleIdx]?.url ?? null;
  const hasPhoto = Boolean(activePhotoUrl);
  const showAnglePicker = mode === "photo" && simplifiedSlots.length > 1;
  const canRunScanGeneration =
    GENERATE_3D_SCAN_ENABLED &&
    angleSlots.length > 0 &&
    !clientUsesAuraScan(patientName);
  const hasGeneratedAuraAssetManifest = Boolean(
    patientAuraManifest?.angles &&
    Object.values(patientAuraManifest.angles).some((asset) =>
      hasGeneratedAuraStillAssets(asset),
    ),
  );
  const hasExistingScanAnalysis = has3D || hasGeneratedAuraAssetManifest;
  const scanActionLabel = hasExistingScanAnalysis
    ? "Regenerate Analysis"
    : "Upgrade Analysis";
  const scanActionTitle = hasExistingScanAnalysis
    ? "Regenerate upgraded analysis"
    : "Upgrade analysis";
  const showFsAnalysisOverview = Boolean(
    viewportExpanded && analysisOverviewClient,
  );
  const hasAnalysisOverviewFindings = Boolean(
    analysisOverviewClient &&
    (getDetectedIssueDisplayStrings(analysisOverviewClient).length > 0 ||
      Object.keys(
        analysisOverviewClient.severityScoresFromAnalyses?.issues ?? {},
      ).length > 0),
  );
  const overviewSoloSpan = showFsAnalysisOverview && !useAuraView;

  const photoModalInitialTab = useMemo((): "front" | "side" => {
    const slot = simplifiedSlots[angleIdx];
    if (!slot) return "front";
    return slot.label === "Side" ? "side" : "front";
  }, [simplifiedSlots, angleIdx]);

  const enterCompareMode = useCallback((scans: PatientProgressScan[]) => {
    if (scans.length !== 2) return;
    setCompareScans(sortProgressScansChronologically(scans));
    setCompareViewAngle("front");
    setAuraPanelCollapsed(true);
  }, []);

  const auraBridge = useMemo((): AuraMirrorHighlightBridge | undefined => {
    if (!useAuraExpandedAnalysis || !analysisOverviewClient) return undefined;
    return {
      highlightTerms: highlightTermsForView,
      activeCategory: auraActiveCategory,
      onActiveCategoryChange: setAuraActiveCategory,
      activeSkinLens: auraActiveSkinLens,
      onActiveSkinLensChange: setAuraActiveSkinLens,
      activeAnalysisArea: auraActiveAnalysisArea,
      onActiveAnalysisAreaChange: setAuraActiveAnalysisArea,
      annotationsHidden: auraAnnotationsHidden,
      panelCollapsed: auraPanelCollapsed,
      onPanelCollapsedChange: setAuraPanelCollapsed,
      patientFiles: {
        photoSlots: angleSlots,
        turntableVideoUrl: effectiveVideoUrl,
        auraManifest: patientAuraManifest,
        annotationsRefreshKey,
        onLoadAnnotation: handleLoadAnnotation,
        onCompareScans: enterCompareMode,
        activeScanId: selectedPreviewScanId,
        onActiveScanIdChange: setSelectedPreviewScanId,
      },
    };
  }, [
    useAuraExpandedAnalysis,
    analysisOverviewClient,
    highlightTermsForView,
    auraActiveCategory,
    auraActiveSkinLens,
    auraActiveAnalysisArea,
    auraAnnotationsHidden,
    auraPanelCollapsed,
    angleSlots,
    effectiveVideoUrl,
    patientAuraManifest,
    annotationsRefreshKey,
    handleLoadAnnotation,
    enterCompareMode,
    selectedPreviewScanId,
  ]);

  const openPatientPhotosSafe = useCallback(
    (initialTab: "front" | "side") => {
      setViewportExpanded(false);
      onOpenPatientPhotos?.(initialTab);
    },
    [onOpenPatientPhotos],
  );

  const toggleAutoRotate3d = useCallback(() => {
    setAutoRotate3d((v) => !v);
  }, []);

  const showToolbarRegions = (hasPhoto || has3D) && !useAuraView;
  const showToolbarRotate = mode === "3d" && has3D && !useAuraView;
  const showToolbarAnglePicker =
    mode === "photo" && showAnglePicker && !useAuraView;
  const showToolbarGallery = Boolean(
    showPatientPhotoGallery && onOpenPatientPhotos,
  );
  const showToolbarTools =
    showToolbarRegions || showToolbarRotate || showToolbarGallery;

  // Keyboard: Escape closes viewport-expanded
  useEffect(() => {
    if (!viewportExpanded) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewportExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [viewportExpanded]);

  const toggleViewportExpanded = useCallback(
    () => setViewportExpanded((v) => !v),
    [],
  );

  // --- Scan generation flow ---

  const applyBackgroundScanSnapshot = useCallback(
    (snapshot: BackgroundScanSnapshot | null) => {
      if (!snapshot) {
        setScanState((prev) =>
          prev.phase === "submitting" || prev.phase === "running"
            ? { phase: "idle" }
            : prev,
        );
        return;
      }

      setScanQuality(normalizeScanQuality(snapshot.quality));

      if (snapshot.phase === "submitting") {
        setScanState((prev) =>
          prev.phase === "submitting" ? prev : { phase: "submitting" },
        );
        return;
      }

      if (snapshot.phase === "running") {
        if (snapshot.videoUrl) {
          applyPreviewVideo(snapshot.videoUrl);
        }
        if (snapshot.auraAssets) {
          setPatientAuraManifestState(snapshot.auraAssets);
          setPatientAuraManifest(patientName, snapshot.auraAssets);
        }
        setScanState((prev) => {
          const next = {
            phase: "running" as const,
            jobId: snapshot.jobId,
            progress: snapshot.progress,
            message: snapshot.message,
            remaining: snapshot.remaining,
          };
          return prev.phase === "running" &&
            prev.jobId === next.jobId &&
            prev.progress === next.progress &&
            prev.message === next.message &&
            prev.remaining === next.remaining
            ? prev
            : next;
        });
        return;
      }

      if (snapshot.phase === "done") {
        if (snapshot.auraAssets) {
          setPatientAuraManifestState(snapshot.auraAssets);
          setPatientAuraManifest(patientName, snapshot.auraAssets);
        }
        if (snapshot.videoUrl) {
          const videoUrl = snapshot.videoUrl;
          setOverrideGlbUrl(videoUrl);
          setScanState((prev) =>
            prev.phase === "done" && prev.videoUrl === videoUrl
              ? prev
              : { phase: "done", videoUrl },
          );
          setMode("3d");
          setViewportExpanded(true);
          const doneKey = `${scanRecordId}:${snapshot.jobId}:${videoUrl}`;
          if (
            appliedDoneScanKeyRef.current !== doneKey &&
            !hasDispatchedDoneScanCallback(doneKey)
          ) {
            appliedDoneScanKeyRef.current = doneKey;
            markDoneScanCallbackDispatched(doneKey);
            onScanGeneratedRef.current?.({
              videoUrl,
              auraAssets: snapshot.auraAssets,
            });
          }
        } else {
          // Analysis-only scan (no 3D video) — still fire onScanGenerated so the
          // parent can call onUpdate() and pick up severity scores from Airtable.
          const doneKey = `${scanRecordId}:${snapshot.jobId}:analysis-only`;
          if (
            appliedDoneScanKeyRef.current !== doneKey &&
            !hasDispatchedDoneScanCallback(doneKey)
          ) {
            appliedDoneScanKeyRef.current = doneKey;
            markDoneScanCallbackDispatched(doneKey);
            onScanGeneratedRef.current?.({
              videoUrl: "",
              auraAssets: snapshot.auraAssets,
            });
          }
          setScanState((prev) =>
            prev.phase === "idle" ? prev : { phase: "idle" },
          );
        }
        return;
      }

      const message = snapshot.error || snapshot.message || "Unknown error";
      setScanState((prev) => {
        const next = { phase: "error" as const, message };
        return prev.phase === "error" && prev.message === next.message
          ? prev
          : next;
      });
    },
    [applyPreviewVideo, patientName, scanRecordId],
  );

  useEffect(() => {
    if (!scanRecordId) return undefined;
    updateBackgroundScanJobMetadata(scanRecordId, {
      clientName: patientName,
      tableName: airtableTableName,
    });
    return subscribeBackgroundScanJob(
      scanRecordId,
      applyBackgroundScanSnapshot,
    );
  }, [
    scanRecordId,
    patientName,
    airtableTableName,
    applyBackgroundScanSnapshot,
  ]);

  /** Submit photos to /api/scan/submit; the background manager keeps polling after navigation. */
  const startScan = useCallback(
    (qualityOverride?: ScanQuality) => {
      const quality = qualityOverride ?? scanQuality;
      previewVideoUrlRef.current = null;
      setScanState({ phase: "submitting" });

      const photoMap = mapSlotsToModalPhotos(
        selectedScanPhotoSlots(angleSlots, selectedScanPhotoKeys),
      );
      if (Object.keys(photoMap).length === 0) {
        setScanState({
          phase: "error",
          message: "No photos available to submit.",
        });
        return;
      }

      // Resolve relative URLs to absolute so the scan backend can download them.
      const absolutePhotoMap = Object.fromEntries(
        Object.entries(photoMap).map(([key, url]) => [
          key,
          url.startsWith("http")
            ? url
            : new URL(url, window.location.href).href,
        ]),
      );

      startBackgroundScanJob({
        recordId: scanRecordId,
        tableName: airtableTableName,
        clientName: patientName,
        quality,
        photos: absolutePhotoMap,
        patientAge:
          typeof analysisOverviewClient?.age === "number"
            ? analysisOverviewClient.age
            : undefined,
      });
    },
    [
      angleSlots,
      selectedScanPhotoKeys,
      patientName,
      scanQuality,
      scanRecordId,
      airtableTableName,
      analysisOverviewClient?.age,
    ],
  );

  const openScanConfig = useCallback(() => {
    const current = getBackgroundScanSnapshot(scanRecordId);
    if (current?.phase === "submitting" || current?.phase === "running") {
      applyBackgroundScanSnapshot(current);
      return;
    }
    clearBackgroundScanJob(scanRecordId);
    setSelectedScanPhotoKeys(defaultScanPhotoSelection(angleSlots));
    setScanState({ phase: "config" });
  }, [scanRecordId, angleSlots, applyBackgroundScanSnapshot]);

  useEffect(() => {
    onViewportExpandedChange?.(viewportExpanded);
  }, [viewportExpanded, onViewportExpandedChange]);

  const cancelScan = useCallback(() => {
    clearBackgroundScanJob(scanRecordId);
    setScanState({ phase: "idle" });
  }, [scanRecordId]);

  // --- Toolbar rendering helper ---

  const expandBtnLabel = viewportExpanded
    ? "Hide analysis (Esc)"
    : "Show analysis";
  const canShowAnalysisToggle = Boolean(
    analysisOverviewClient &&
    hasAnalysisOverviewFindings &&
    (has3D || hasPhoto || useAuraView),
  );

  const expandAnalysisButton = canShowAnalysisToggle ? (
    <button
      type="button"
      className="fmp-ai-action-btn fmp-analysis-toggle-btn"
      onClick={toggleViewportExpanded}
      aria-pressed={viewportExpanded}
      title={expandBtnLabel}
    >
      <span
        className="fmp-ai-action-icon fmp-ai-action-icon--gradient"
        aria-hidden
      />
      <span className="fmp-ai-action-label">
        {viewportExpanded ? "Hide analysis" : "Show analysis"}
      </span>
    </button>
  ) : null;

  const analysisToggleDock = expandAnalysisButton ? (
    <div className="fmp-analysis-toggle-dock">{expandAnalysisButton}</div>
  ) : null;

  const scanning =
    scanState.phase === "running" || scanState.phase === "submitting";

  const patientPhotosIcon = (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );

  const auraTopbarPhotosButton =
    showToolbarGallery && !scanning ? (
      <button
        type="button"
        className="fmp-fullscreen-btn"
        onClick={() => openPatientPhotosSafe(photoModalInitialTab)}
        title="All photos and originals"
      >
        {patientPhotosIcon}
        Photos
      </button>
    ) : null;

  const auraOverlayPhotosButton =
    showToolbarGallery && !scanning ? (
      <button
        type="button"
        className="fmp-regenerate-3d-btn"
        onClick={() => openPatientPhotosSafe(photoModalInitialTab)}
        title="All photos and originals"
      >
        {patientPhotosIcon}
        Photos
      </button>
    ) : null;

  const showOverlayToolbar =
    (has3D || hasPhoto || canRunScanGeneration) &&
    !(useAuraView && viewportExpanded);

  const hideToolbarForAuraScanConfig =
    useAuraView && scanState.phase === "config";

  const toolbar = (
    <div className="fmp-toolbar">
      <div className="fmp-toolbar-start">
        {has3D && !useAuraView && scanState.phase !== "running" && (
          <div className="fmp-mode-tabs" role="tablist" aria-label="View mode">
            <button
              role="tab"
              aria-selected={mode === "3d"}
              className={`fmp-tab${mode === "3d" ? " fmp-tab--active" : ""}`}
              onClick={() => setMode("3d")}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              3D
            </button>
            <button
              role="tab"
              aria-selected={mode === "photo"}
              className={`fmp-tab${mode === "photo" ? " fmp-tab--active" : ""}`}
              onClick={() => setMode("photo")}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Photo
            </button>
          </div>
        )}

        {showToolbarAnglePicker ? (
          <>
            {has3D && !useAuraView ? (
              <span className="fmp-toolbar-divider" aria-hidden />
            ) : null}
            <div
              className="fmp-mode-tabs"
              role="tablist"
              aria-label="Photo angle"
            >
              {simplifiedSlots.map((slot, i) => (
                <button
                  key={`${slot.url}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === angleIdx}
                  className={`fmp-tab${i === angleIdx ? " fmp-tab--active" : ""}`}
                  onClick={() => setAngleIdx(i)}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {scanning && (
          <div className="fmp-scan-progress-bar-wrap">
            <div
              className="fmp-scan-progress-bar"
              style={{
                width: `${Math.round(
                  (scanState.phase === "submitting"
                    ? 0.02
                    : (scanState as { progress: number }).progress) * 100,
                )}%`,
              }}
            />
            <span className="fmp-scan-progress-label">
              {scanState.phase === "submitting"
                ? "Submitting…"
                : `${(scanState as { message: string }).message}  ${formatRemaining((scanState as { remaining: number }).remaining)}`}
            </span>
          </div>
        )}

        {canRunScanGeneration && !scanning && scanState.phase !== "config" && (
          <button
            type="button"
            className="fmp-upgrade-analysis-btn"
            onClick={openScanConfig}
            title={scanActionTitle}
          >
            <span className="fmp-upgrade-analysis-label">
              {scanActionLabel}
            </span>
          </button>
        )}

        {useAuraView && scanState.phase !== "config" && auraOverlayPhotosButton}

        {scanState.phase === "error" && (
          <span className="fmp-scan-error-label" title={scanState.message}>
            Scan failed —{" "}
            <button
              type="button"
              className="fmp-scan-retry-link"
              onClick={() => setScanState({ phase: "idle" })}
            >
              retry
            </button>
          </span>
        )}
      </div>

      <div className="fmp-toolbar-end">
        {scanning && (
          <button
            type="button"
            className="fmp-fullscreen-btn"
            onClick={cancelScan}
          >
            Cancel
          </button>
        )}

        {!useAuraView && showToolbarTools ? (
          <div className="fmp-toolbar-tools" aria-label="View tools">
            {showToolbarRegions ? (
              <FaceMirrorRegionsPicker
                variant="toolbar"
                manualHighlightedRegionIds={manualHighlightedRegionIds}
                onSetManualHighlightedRegionIds={setManualHighlightedRegionIds}
              />
            ) : null}
            {showToolbarRotate ? (
              <button
                type="button"
                className={`fmp-toolbar-tool-btn${autoRotate3d ? " fmp-toolbar-tool-btn--active" : ""}`}
                onClick={toggleAutoRotate3d}
                aria-pressed={autoRotate3d}
                title={
                  autoRotate3d ? "Pause auto-rotate" : "Auto-rotate 3D view"
                }
              >
                <AutoRotateHeadIcon size={14} />
                Rotate
              </button>
            ) : null}
            {showToolbarGallery ? (
              <button
                type="button"
                className="fmp-toolbar-tool-btn"
                onClick={() => openPatientPhotosSafe(photoModalInitialTab)}
                title="All photos and originals"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                Photos
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  // --- Canvas area helpers ---

  const photoStageProps = {
    activePhotoUrl: activePhotoUrl!,
    patientName,
    highlightTerms: visibleHighlightTermsForView,
    highlightedRegionIds: visibleManualRegionsForView,
    showAnnotations: hasAnnotations,
  };

  const auraViewerFraming = useMemo(
    () => ({
      initialZoom: auraDisplayManifest?.viewerTurntableZoom,
      photoInitialZoom: useAuraExpandedAnalysis
        ? Math.min(auraDisplayManifest?.viewerPhotoZoom ?? 1.28, 1.28)
        : auraDisplayManifest?.viewerPhotoZoom,
      initialPanY: auraDisplayManifest?.viewerInitialPanY,
    }),
    [auraDisplayManifest, useAuraExpandedAnalysis],
  );

  const tabDefaultHighlights = useMemo(() => {
    if (!analysisOverviewClient) return undefined;
    return {
      ...buildDefaultTabSeverityHighlights(analysisOverviewClient),
      ...buildSkinLensDefaultHighlights(analysisOverviewClient),
    };
  }, [analysisOverviewClient]);

  const analysisAreaHighlights = useMemo(() => {
    if (!useAuraExpandedAnalysis || !analysisOverviewClient) return undefined;
    if (
      auraActiveCategory !== "volumeLoss" &&
      auraActiveCategory !== "proportions"
    ) {
      return undefined;
    }
    if (!isAuraAnalysisAreaFiltered(auraActiveAnalysisArea)) {
      return undefined;
    }
    return buildAnalysisAreaFaceHighlights(
      analysisOverviewClient,
      auraActiveCategory,
      auraActiveAnalysisArea,
    );
  }, [
    useAuraExpandedAnalysis,
    analysisOverviewClient,
    auraActiveCategory,
    auraActiveAnalysisArea,
  ]);

  const auraHighlightPickerOptions = useMemo(() => {
    if (!useAuraExpandedAnalysis || !analysisOverviewClient) return undefined;

    const detected = getDetectedIssuesFromClient(analysisOverviewClient);
    const severityIssues = getEffectiveSeverityIssues(analysisOverviewClient);
    const options: FaceMirrorHighlightOption[] = [];
    const seenIssueKeys = new Set<string>();
    const addIssue = (issue: string, subScoreName?: string) => {
      const label = canonicalIssueDisplayLabel(issue);
      const key = normalizeIssue(label);
      if (!key || seenIssueKeys.has(key)) return;
      seenIssueKeys.add(key);
      options.push(
        highlightOptionForIssue(label, auraActiveCategory, subScoreName),
      );
    };
    const sortBySeverity = (a: string, b: string) => {
      const aBadness =
        issueSeverityVisual(a, severityIssues, "#60a5fa").badness01 ?? -1;
      const bBadness =
        issueSeverityVisual(b, severityIssues, "#60a5fa").badness01 ?? -1;
      if (bBadness !== aBadness) return bBadness - aBadness;
      return a.localeCompare(b);
    };

    if (auraActiveCategory === "skinHealth") {
      const effectiveSkinLens =
        auraActiveSkinLens === "texture" ? "pigmentation" : auraActiveSkinLens;
      const categoryIssues = detectedIssuesForCategory(
        auraActiveCategory,
        detected,
      );
      for (const issue of collectIssuesForSkinLens(
        effectiveSkinLens,
        categoryIssues,
        severityIssues,
      )) {
        addIssue(issue, subScoreNameForIssue(auraActiveCategory, issue));
      }
      return options;
    }

    const category = CATEGORIES.find((cat) => cat.key === auraActiveCategory);
    const subScores = category?.subScores ?? [];
    const focusedSubScores = isAuraAnalysisAreaFiltered(auraActiveAnalysisArea)
      ? subScores.filter((sub) => sub.name === auraActiveAnalysisArea)
      : subScores;

    for (const subScore of focusedSubScores) {
      const issues = detectedIssuesForSubScore(
        auraActiveCategory,
        subScore.name,
        detected,
      ).sort(sortBySeverity);
      for (const issue of issues) addIssue(issue, subScore.name);
    }

    return options;
  }, [
    useAuraExpandedAnalysis,
    analysisOverviewClient,
    auraActiveCategory,
    auraActiveSkinLens,
    auraActiveAnalysisArea,
  ]);

  const auraMarkersToggleButton = useAuraExpandedAnalysis ? (
    <button
      type="button"
      className={`fmp-aura-marker-toggle${auraAnnotationsHidden ? " fmp-aura-marker-toggle--active" : ""}`}
      onClick={() => setAuraAnnotationsHidden((hidden) => !hidden)}
      aria-pressed={auraAnnotationsHidden}
      aria-label={auraAnnotationsHidden ? "Show markers" : "Hide markers"}
      title={auraAnnotationsHidden ? "Show markers" : "Hide markers"}
    >
      <AuraMarkerVisibilityIcon hidden={auraAnnotationsHidden} />
      <span>{auraAnnotationsHidden ? "Show markers" : "Hide markers"}</span>
    </button>
  ) : null;

  // Shared AuraFaceView props — used for both turntable and photos-only modes.
  const auraFaceViewProps = {
    embedded: true as const,
    viewerAngleAssets: auraPhotoOnlyPreview
      ? auraPhotoOnlyViewerAngleAssets
      : viewerAngleAssets,
    useBundledCvAnnotations: clientUsesAuraScan(patientName),
    cvAnnotations: auraDisplayManifest?.cvAnnotations,
    availableViewAngles: auraPhotoOnlyPreview
      ? auraPhotoOnlyAvailableViewAngles
      : availableViewAngles,
    ...auraViewerFraming,
    highlightTerms: visibleHighlightTermsForView,
    highlightedRegionIds: visibleManualRegionsForView,
    hasHighlights:
      !annotationsHiddenForView && manualHighlightedRegionIds.length > 0,
    onClearHighlights: () => {
      setManualHighlightedRegionIds([]);
    },
    overviewCategory: useAuraExpandedAnalysis ? auraActiveCategory : undefined,
    onOverviewCategoryChange: useAuraExpandedAnalysis
      ? setAuraActiveCategory
      : undefined,
    activeSkinLens: useAuraExpandedAnalysis ? auraActiveSkinLens : undefined,
    onActiveSkinLensChange: useAuraExpandedAnalysis
      ? setAuraActiveSkinLens
      : undefined,
    activeAnalysisArea: useAuraExpandedAnalysis
      ? auraActiveAnalysisArea
      : undefined,
    onActiveAnalysisAreaChange: useAuraExpandedAnalysis
      ? setAuraActiveAnalysisArea
      : undefined,
    defaultCleanColorView: useAuraExpandedAnalysis,
    annotateStrokes: annotateStrokes,
    onAnnotateStrokesChange: setAnnotateStrokes,
    onAnnotateSave: analysisOverviewClient ? handleSaveAnnotation : undefined,
    regionPicker: useAuraView
      ? {
          manualHighlightedRegionIds,
          highlightOptions: auraHighlightPickerOptions,
          onSetManualHighlightedRegionIds: setManualHighlightedRegionIds,
        }
      : undefined,
    has3DVideo: has3D,
    showNoIssuesMessage: !clientUsesAuraScan(patientName),
    tabDefaultHighlights: annotationsHiddenForView
      ? undefined
      : tabDefaultHighlights,
    analysisAreaHighlights: annotationsHiddenForView
      ? null
      : analysisAreaHighlights,
    annotationsHidden: annotationsHiddenForView,
    topbarStart:
      auraMarkersToggleButton ??
      (scanState.phase === "config" ? auraTopbarPhotosButton : undefined),
    topbarEnd:
      auraMarkersToggleButton && scanState.phase === "config"
        ? auraTopbarPhotosButton
        : undefined,
  };

  const auraFaceViewScanKey = selectedPreviewScan?.id ?? "preview-default";

  const viewer3D =
    useAuraView && !has3D ? (
      // Photos-only Aura view: no turntable video, show angle stills with annotation overlays.
      <AuraFaceView
        key={auraFaceViewScanKey}
        {...auraFaceViewProps}
        preScanPreview
        turntableOnly={false}
        videoUrl=""
        disableDemoTurntableFallback
        disableWheelZoom
      />
    ) : auraDisplayVideoUrl ? (
      useAuraView ? (
        <AuraFaceView
          key={auraFaceViewScanKey}
          {...auraFaceViewProps}
          preScanPreview={auraPhotoOnlyPreview}
          turntableOnly
          videoUrl={auraDisplayVideoUrl}
          textureVideoUrl={
            clientUsesAuraScan(patientName)
              ? undefined
              : auraDisplayManifest?.textureVideoUrl
          }
          pigmentationVideoUrl={
            clientUsesAuraScan(patientName)
              ? undefined
              : auraDisplayManifest?.pigmentationVideoUrl
          }
          rednessVideoUrl={
            clientUsesAuraScan(patientName)
              ? undefined
              : auraDisplayManifest?.rednessVideoUrl
          }
          poresVideoUrl={
            clientUsesAuraScan(patientName)
              ? undefined
              : auraDisplayManifest?.poresVideoUrl
          }
          wrinklesVideoUrl={
            clientUsesAuraScan(patientName)
              ? undefined
              : auraDisplayManifest?.wrinklesVideoUrl
          }
          disableDemoTurntableFallback={patientGeneratedAura}
        />
      ) : (
        <Face3DViewer
          videoUrl={auraDisplayVideoUrl}
          autoRotate={autoRotate3d}
          controlledTimeRatio={autoRotate3d ? undefined : 0.5}
          showAnnotations={hasAnnotations}
          highlightTerms={visibleHighlightTermsForView}
          highlightedAnnotationRegionIds={visibleManualRegionsForView}
          initialZoom={1.75}
          initialPanY={-88}
        />
      )
    ) : null;

  const compareMetricKey: ProgressMetricKey =
    auraActiveCategory === "volumeLoss"
      ? "volume"
      : auraActiveCategory === "proportions"
        ? "structure"
        : auraActiveSkinLens === "redness" ||
            auraActiveSkinLens === "pores" ||
            auraActiveSkinLens === "wrinkles"
          ? auraActiveSkinLens
          : "pigmentation";

  const compareAngleOptions = useMemo((): ViewAngle[] => {
    if (!compareScans || compareScans.length !== 2) return ["front"];
    const angleSets = compareScans.map((scan) => {
      const angles =
        getAvailableViewAngles(scan.auraManifest, scan.photoSlots ?? []) ??
        (scan.photoSlots?.length
          ? inferAvailableViewAnglesFromPhotoSlots(scan.photoSlots)
          : TANYA_TAN_LEFT_NAV_ORDER);
      return new Set(angles as ViewAngle[]);
    });
    const shared = TANYA_TAN_LEFT_NAV_ORDER.filter((angle) =>
      angleSets.every((set) => set.has(angle as ViewAngle)),
    ) as ViewAngle[];
    return shared.length > 0 ? shared : ["front"];
  }, [compareScans]);

  useEffect(() => {
    if (!compareScans || compareScans.length !== 2) return;
    if (compareAngleOptions.includes(compareViewAngle)) return;
    setCompareViewAngle(
      compareAngleOptions.includes("front") ? "front" : compareAngleOptions[0],
    );
  }, [compareAngleOptions, compareScans, compareViewAngle]);

  const activeCompareMode =
    COMPARE_MODE_OPTIONS.find((option) => option.id === compareMetricKey) ??
    COMPARE_MODE_OPTIONS[0];
  const skinCompareOptions = COMPARE_MODE_OPTIONS.filter(
    (option) => option.category === "skinHealth",
  );
  const activeSkinCompareOption =
    skinCompareOptions.find((option) => option.id === compareMetricKey) ??
    skinCompareOptions.find(
      (option) => option.skinLens === auraActiveSkinLens,
    ) ??
    skinCompareOptions[0];
  const volumeCompareOption =
    COMPARE_MODE_OPTIONS.find((option) => option.id === "volume") ??
    COMPARE_MODE_OPTIONS[4];
  const structureCompareOption =
    COMPARE_MODE_OPTIONS.find((option) => option.id === "structure") ??
    COMPARE_MODE_OPTIONS[5];
  const activeCompareCategory =
    activeCompareMode.category === "skinHealth"
      ? "skinHealth"
      : activeCompareMode.category;

  const syncCompareMetricSelection = useCallback((metricKey: ProgressMetricKey) => {
    const option = COMPARE_MODE_OPTIONS.find((item) => item.id === metricKey);
    if (!option) return;

    setAuraActiveCategory(option.category);
    if (option.skinLens) {
      setAuraActiveSkinLens(option.skinLens);
    }
    if (option.category !== "skinHealth") {
      setAuraActiveAnalysisArea(AURA_ANALYSIS_AREA_ALL);
    }
    setActiveProgressChangeId(metricKey);
    setProgressCopilotConfig((current) =>
      current ? { ...current, focusMetricKey: metricKey } : current,
    );
  }, []);

  const registerCompareViewportApi = useCallback(
    (paneIndex: 0 | 1, api: CompareViewportPaneApi | null) => {
      compareViewportApisRef.current[paneIndex] = api;
    },
    [],
  );

  const readLiveCompareTransforms =
    useCallback((): [ViewportTransform, ViewportTransform] => {
      return [
        compareViewportApisRef.current[0]?.getTransform() ??
          compareTransformReportsRef.current[0],
        compareViewportApisRef.current[1]?.getTransform() ??
          compareTransformReportsRef.current[1],
      ];
    }, []);

  const resetCompareViewportSync = useCallback(() => {
    compareZoomLockedRef.current = false;
    setCompareZoomLocked(false);
    compareLinkedTransformsRef.current = null;
    compareTransformReportsRef.current = [
      defaultCompareViewportTransform(),
      defaultCompareViewportTransform(),
    ];
  }, []);

  const resetCompareSession = useCallback(() => {
    resetCompareViewportSync();
    setCompareAnnotateActive(false);
    setCompareAnnotateStrokes([]);
  }, [resetCompareViewportSync]);


  const handleCompareScanChange = useCallback(
    (paneIndex: 0 | 1, scanId: string) => {
      const scan = patientProgressScans.find((entry) => entry.id === scanId);
      if (!scan) return;
      setCompareScans((current) => {
        if (!current || current.length !== 2) return current;
        const otherIndex = paneIndex === 0 ? 1 : 0;
        if (current[otherIndex]?.id === scanId) return current;
        const next: [PatientProgressScan, PatientProgressScan] = [...current] as [
          PatientProgressScan,
          PatientProgressScan,
        ];
        next[paneIndex] = scan;
        return next;
      });
    },
    [patientProgressScans],
  );

  useEffect(() => {
    resetCompareViewportSync();
  }, [compareViewAngle, compareMetricKey, compareScans, resetCompareViewportSync]);

  /** Stable ref-based handler — called on every pan/zoom event from each compare pane. */
  const handleCompareViewportChange0 = useCallback(
    (transform: ViewportTransform) => {
      compareTransformReportsRef.current[0] = transform;
      if (!compareZoomLockedRef.current) return;
      const base = compareLinkedTransformsRef.current;
      if (!base) return;
      const zoomRatio = base[0].zoom > 0 ? transform.zoom / base[0].zoom : 1;
      const panDx = transform.panX - base[0].panX;
      const panDy = transform.panY - base[0].panY;
      const other: ViewportTransform = {
        zoom: clampViewportZoom(base[1].zoom * zoomRatio, COMPARE_VIEWPORT_MIN_ZOOM),
        panX: base[1].panX + panDx,
        panY: base[1].panY + panDy,
      };
      compareLinkedTransformsRef.current = [transform, other];
      compareViewportApisRef.current[1]?.applyTransform(other);
    },
    [],
  );

  const handleCompareViewportChange1 = useCallback(
    (transform: ViewportTransform) => {
      compareTransformReportsRef.current[1] = transform;
      if (!compareZoomLockedRef.current) return;
      const base = compareLinkedTransformsRef.current;
      if (!base) return;
      const zoomRatio = base[1].zoom > 0 ? transform.zoom / base[1].zoom : 1;
      const panDx = transform.panX - base[1].panX;
      const panDy = transform.panY - base[1].panY;
      const other: ViewportTransform = {
        zoom: clampViewportZoom(base[0].zoom * zoomRatio, COMPARE_VIEWPORT_MIN_ZOOM),
        panX: base[0].panX + panDx,
        panY: base[0].panY + panDy,
      };
      compareLinkedTransformsRef.current = [other, transform];
      compareViewportApisRef.current[0]?.applyTransform(other);
    },
    [],
  );

  const registerCompareViewportApi0 = useCallback(
    (api: CompareViewportPaneApi | null) => registerCompareViewportApi(0, api),
    [registerCompareViewportApi],
  );
  const registerCompareViewportApi1 = useCallback(
    (api: CompareViewportPaneApi | null) => registerCompareViewportApi(1, api),
    [registerCompareViewportApi],
  );

  const toggleCompareZoomLock = useCallback(() => {
    if (!compareZoomLockedRef.current) {
      const transforms = readLiveCompareTransforms();
      compareLinkedTransformsRef.current = [{ ...transforms[0] }, { ...transforms[1] }];
      compareZoomLockedRef.current = true;
      setCompareZoomLocked(true);
      return;
    }
    compareLinkedTransformsRef.current = null;
    compareZoomLockedRef.current = false;
    setCompareZoomLocked(false);
  }, [readLiveCompareTransforms]);

  const progressCopilotChanges = useMemo(() => {
    if (!compareScans || compareScans.length !== 2) return [];
    return buildProgressCopilotChanges(compareScans[0], compareScans[1]);
  }, [compareScans]);

  useEffect(() => {
    if (progressCopilotChanges.length === 0) {
      setActiveProgressChangeId(null);
      setActiveProgressRegionId(null);
      return;
    }
    if (
      activeProgressChangeId &&
      progressCopilotChanges.some(
        (change) => change.id === activeProgressChangeId,
      )
    ) {
      return;
    }
    setActiveProgressChangeId(progressCopilotChanges[0].id);
    setActiveProgressRegionId(null);
  }, [activeProgressChangeId, progressCopilotChanges]);

  useEffect(() => {
    setActiveProgressRegionId(null);
  }, [compareScans, compareViewAngle, compareMetricKey]);

  const activeProgressChange =
    progressCopilotChanges.find(
      (change) => change.id === activeProgressChangeId,
    ) ??
    progressCopilotChanges[0] ??
    null;
  const activeProgressRegionIds = (() => {
    if (!activeProgressRegionId || !activeProgressChange) return [];
    const expandedIds = expandVirtualRegionId(activeProgressRegionId);
    const hasMatch = expandedIds.some((id) =>
      activeProgressChange.regionIds.includes(id),
    );
    return hasMatch ? expandedIds : [];
  })();
  const activeProgressBeforeBand = activeProgressChange
    ? progressSeverityBand(activeProgressChange.before)
    : null;
  const activeProgressAfterBand = activeProgressChange
    ? progressSeverityBand(activeProgressChange.after)
    : null;
  const activeProgressBeforeRegionColors =
    activeProgressChange && activeProgressRegionId
      ? Object.fromEntries(
          expandVirtualRegionId(activeProgressRegionId).map((id) => [
            id,
            progressRegionalSeverityBand(
              activeProgressChange.id,
              activeProgressChange.before,
              activeProgressRegionId,
            ).color,
          ]),
        )
      : undefined;
  const activeProgressAfterRegionColors =
    activeProgressChange && activeProgressRegionId
      ? Object.fromEntries(
          expandVirtualRegionId(activeProgressRegionId).map((id) => [
            id,
            progressRegionalSeverityBand(
              activeProgressChange.id,
              activeProgressChange.after,
              activeProgressRegionId,
            ).color,
          ]),
        )
      : undefined;
  const applyProgressCopilotConfig = useCallback(
    (config: ProgressCopilotConfig) => {
      if (!compareScans || compareScans.length !== 2) return;
      const discussedItems = analysisOverviewClient?.discussedItems ?? [];
      const includedTreatments = discussedItems.filter((item) =>
        config.includedTreatmentIds.includes(item.id),
      );
      setProgressCopilotConfig(config);
      setProgressCopilotDraft(
        buildProgressCopilotDraft({
          patientName,
          patientAge: analysisOverviewClient?.age,
          goal: config.goal,
          skinComplaints: config.skinComplaints,
          previousTreatmentContext: config.previousTreatmentContext,
          beforeScan: compareScans[0],
          afterScan: compareScans[1],
          activeMetricKey: config.focusMetricKey,
          discussedItems: includedTreatments,
        }),
      );
      syncCompareMetricSelection(config.focusMetricKey);
    },
    [
      analysisOverviewClient?.age,
      analysisOverviewClient?.discussedItems,
      compareScans,
      patientName,
      syncCompareMetricSelection,
    ],
  );

  useEffect(() => {
    if (!compareScans || compareScans.length !== 2) {
      compareCopilotSessionRef.current = null;
      setProgressCopilotConfig(null);
      setProgressCopilotDraft(null);
      return;
    }
    const sessionKey = `${compareScans[0].id}:${compareScans[1].id}`;
    if (compareCopilotSessionRef.current === sessionKey) return;
    compareCopilotSessionRef.current = sessionKey;
    const leadMetric = primaryProgressMetricKey(compareScans[0], compareScans[1]);
    applyProgressCopilotConfig(
      createDefaultProgressCopilotConfig(analysisOverviewClient, leadMetric),
    );
  }, [analysisOverviewClient, applyProgressCopilotConfig, compareScans]);

  const handleProgressChangeSelect = (change: ProgressCopilotChange) => {
    setActiveProgressRegionId(null);
    if (!progressCopilotConfig) {
      syncCompareMetricSelection(change.id);
      return;
    }
    applyProgressCopilotConfig({
      ...progressCopilotConfig,
      focusMetricKey: change.id,
    });
  };

  const handleProgressRegionSelect = (
    change: ProgressCopilotChange,
    regionId: string,
  ) => {
    const isAlreadySelected =
      activeProgressRegionId === regionId &&
      activeProgressChange?.id === change.id;

    if (isAlreadySelected) {
      setActiveProgressRegionId(null);
      return;
    }

    setActiveProgressChangeId(change.id);
    setActiveProgressRegionId(regionId);
    if (!progressCopilotConfig) {
      syncCompareMetricSelection(change.id);
      return;
    }
    if (progressCopilotConfig.focusMetricKey === change.id) return;
    applyProgressCopilotConfig({
      ...progressCopilotConfig,
      focusMetricKey: change.id,
    });
  };

  const handleCompareModeChange = useCallback(
    (option: CompareModeOption) => {
      setActiveProgressRegionId(null);
      if (!progressCopilotConfig) {
        syncCompareMetricSelection(option.id);
        return;
      }
      applyProgressCopilotConfig({
        ...progressCopilotConfig,
        focusMetricKey: option.id,
      });
    },
    [applyProgressCopilotConfig, progressCopilotConfig, syncCompareMetricSelection],
  );

  useEffect(() => {
    setProgressCopilotOpen(false);
    setAdaptConfigOpen(false);
  }, [compareScans]);

  const discussedItemsForCopilot =
    analysisOverviewClient?.discussedItems ?? [];

  const updateProgressCopilotConfig = useCallback(
    (patch: Partial<ProgressCopilotConfig>) => {
      setProgressCopilotConfig((current) =>
        current ? { ...current, ...patch } : current,
      );
    },
    [],
  );

  const toggleProgressCopilotTreatment = useCallback((itemId: string) => {
    setProgressCopilotConfig((current) => {
      if (!current) return current;
      const included = new Set(current.includedTreatmentIds);
      if (included.has(itemId)) included.delete(itemId);
      else included.add(itemId);
      return { ...current, includedTreatmentIds: [...included] };
    });
  }, []);

  const compareViewer =
    compareScans?.length === 2 && useAuraView ? (
      <div
        className={`fmp-scan-compare${
          progressCopilotOpen ? " fmp-scan-compare--copilot-open" : ""
        }`}
      >
        <div className="fmp-scan-compare__toolbar">
          <div className="fmp-scan-compare__mode-controls">
            <nav
              className="avf-pills fmp-scan-compare__pills"
              role="tablist"
              aria-label="Compare analysis mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeCompareCategory === "skinHealth"}
                className={`avf-pill${activeCompareCategory === "skinHealth" ? " avf-pill--active" : ""}`}
                onClick={() => handleCompareModeChange(activeSkinCompareOption)}
              >
                Skin
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeCompareCategory === "volumeLoss"}
                className={`avf-pill${activeCompareCategory === "volumeLoss" ? " avf-pill--active" : ""}`}
                onClick={() => handleCompareModeChange(volumeCompareOption)}
              >
                Volume
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeCompareCategory === "proportions"}
                className={`avf-pill${activeCompareCategory === "proportions" ? " avf-pill--active" : ""}`}
                onClick={() => handleCompareModeChange(structureCompareOption)}
              >
                Structure
              </button>
            </nav>
            {activeCompareCategory === "skinHealth" ? (
              <nav
                className="avf-skin-sub-tabs fmp-scan-compare__skin-tabs"
                aria-label="Compare skin analysis mode"
              >
                {skinCompareOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`avf-skin-sub-tab${
                      option.id === activeCompareMode.id
                        ? " avf-skin-sub-tab--active"
                        : ""
                    }`}
                    onClick={() => handleCompareModeChange(option)}
                  >
                    {option.label}
                  </button>
                ))}
              </nav>
            ) : null}
          </div>
          <div className="fmp-scan-compare__toolbar-actions">
            <button
              type="button"
              className="fmp-scan-compare__exit"
              onClick={() => {
                setCompareScans(null);
                setAuraPanelCollapsed(false);
                resetCompareSession();
              }}
            >
              Exit Compare
            </button>
          </div>
        </div>
        <div className="fmp-scan-compare__main">
          <nav
            className="avf-leftnav fmp-scan-compare__leftnav"
            aria-label="Compare view angle"
          >
            {compareAngleOptions.map((angle) => (
              <button
                key={angle}
                type="button"
                className={`avf-angle-btn${angle === compareViewAngle ? " avf-angle-btn--active" : ""}`}
                onClick={() => setCompareViewAngle(angle)}
                aria-label={COMPARE_ANGLE_LABELS[angle]}
                title={COMPARE_ANGLE_LABELS[angle]}
              >
                <img
                  src={COMPARE_ANGLE_ICON_SRC[angle]}
                  alt=""
                  className="avf-angle-icon"
                  draggable={false}
                />
              </button>
            ))}
          </nav>
          <div className="fmp-scan-compare__viewers" ref={compareViewersRef}>
            {compareScans.map((scan, index) => {
              const scanVideo =
                scan.turntableVideoUrl?.trim() ||
                scan.auraManifest?.turntableVideoUrl?.trim() ||
                effectiveVideoUrl ||
                "";
              const scanViewerAssets = scan.auraManifest
                ? buildViewerAngleAssetsFromManifest(
                    scan.auraManifest,
                    auraFaceViewProps.viewerAngleAssets.front.src,
                  )
                : scan.photoSlots?.length
                  ? buildViewerAngleAssetsFromPhotoSlots(scan.photoSlots)
                  : auraFaceViewProps.viewerAngleAssets;
              const scanAvailableAngles =
                getAvailableViewAngles(
                  scan.auraManifest,
                  scan.photoSlots ?? [],
                ) ??
                (scan.photoSlots?.length
                  ? inferAvailableViewAnglesFromPhotoSlots(scan.photoSlots)
                  : auraFaceViewProps.availableViewAngles);
              return (
                <section
                  key={scan.id}
                  className={`fmp-scan-compare__pane${
                    compareAnnotateActive
                      ? " fmp-scan-compare__pane--annotate-target"
                      : ""
                  }`}
                >
                  <div className="fmp-scan-compare__pane-label">
                    <span className="fmp-scan-compare__pane-role">
                      {index === 0 ? "Baseline scan" : "Follow-up scan"}
                    </span>
                    {patientProgressScans.length > 1 ? (
                      <select
                        className="fmp-scan-compare__pane-select"
                        value={scan.id}
                        onChange={(event) =>
                          handleCompareScanChange(
                            index as 0 | 1,
                            event.target.value,
                          )
                        }
                        aria-label={
                          index === 0
                            ? "Baseline scan date"
                            : "Follow-up scan date"
                        }
                      >
                        {patientProgressScans.map((option) => (
                          <option
                            key={option.id}
                            value={option.id}
                            disabled={
                              option.id ===
                              compareScans[index === 0 ? 1 : 0]?.id
                            }
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <strong>{scan.dateLabel}</strong>
                    )}
                  </div>
                  <AuraFaceView
                    {...auraFaceViewProps}
                    className="avf-root--compare-pane"
                    viewerAngleAssets={scanViewerAssets}
                    availableViewAngles={scanAvailableAngles}
                    cvAnnotations={scan.auraManifest?.cvAnnotations}
                    useBundledCvAnnotations={
                      scan.auraManifest
                        ? false
                        : auraFaceViewProps.useBundledCvAnnotations
                    }
                    videoUrl={scanVideo}
                    textureVideoUrl={scan.auraManifest?.textureVideoUrl}
                    pigmentationVideoUrl={
                      scan.auraManifest?.pigmentationVideoUrl
                    }
                    rednessVideoUrl={scan.auraManifest?.rednessVideoUrl}
                    poresVideoUrl={scan.auraManifest?.poresVideoUrl}
                    wrinklesVideoUrl={scan.auraManifest?.wrinklesVideoUrl}
                    disableDemoTurntableFallback={Boolean(scan.auraManifest)}
                    turntableOnly
                    forcePhotoStillMode
                    activeViewAngle={compareViewAngle}
                    onActiveViewAngleChange={setCompareViewAngle}
                    hideViewerControls
                    defaultCleanColorView={false}
                    photoInitialZoom={COMPARE_VIEWPORT_DEFAULT_ZOOM}
                    photoMinZoom={COMPARE_VIEWPORT_MIN_ZOOM}
                    suppressCalloutLabels={true}
                    highlightedRegionIds={activeProgressRegionIds}
                    annotationColor={
                      index === 0
                        ? activeProgressBeforeBand?.color
                        : activeProgressAfterBand?.color
                    }
                    annotationColorsByRegionId={
                      index === 0
                        ? activeProgressBeforeRegionColors
                        : activeProgressAfterRegionColors
                    }
                    onViewportTransformChange={
                      index === 0
                        ? handleCompareViewportChange0
                        : handleCompareViewportChange1
                    }
                    onViewportTransformReady={
                      index === 0
                        ? registerCompareViewportApi0
                        : registerCompareViewportApi1
                    }
                    topbarStart={undefined}
                    topbarEnd={undefined}
                  />
                </section>
              );
            })}
            <div className="fmp-scan-compare__annotate-overlay">
              <AnnotateDrawing
                active={compareAnnotateActive}
                strokes={compareAnnotateStrokes}
                onStrokesChange={setCompareAnnotateStrokes}
                onDownload={handleCompareAnnotateDownload}
                onSave={analysisOverviewClient ? handleCompareAnnotateSave : undefined}
                saveLabel={compareAnnotateSaveLabel}
              />
            </div>
          </div>
          <aside
            className="fmp-scan-compare__rightnav avf-rightnav"
            aria-label="Compare tools"
          >
            <button
              type="button"
              className={`avf-tool-btn fmp-scan-compare__tool-btn${
                compareAnnotateActive ? " avf-tool-btn--active" : ""
              }`}
              onClick={() => setCompareAnnotateActive((active) => !active)}
              aria-pressed={compareAnnotateActive}
              title={
                compareAnnotateActive
                  ? "Stop annotating"
                  : "Annotate both scans"
              }
              aria-label={
                compareAnnotateActive
                  ? "Stop annotating"
                  : "Annotate both scans"
              }
            >
              <CompareAnnotateIcon />
            </button>
            <button
              type="button"
              className={`avf-tool-btn fmp-scan-compare__tool-btn${
                compareZoomLocked ? " avf-tool-btn--active" : ""
              }`}
              onClick={toggleCompareZoomLock}
              aria-pressed={compareZoomLocked}
              title={
                compareZoomLocked
                  ? "Unlock zoom and pan"
                  : "Lock zoom and pan together"
              }
              aria-label={
                compareZoomLocked
                  ? "Unlock zoom and pan"
                  : "Lock zoom and pan together"
              }
            >
              <CompareLinkZoomIcon linked={compareZoomLocked} />
            </button>
          </aside>
          {progressCopilotDraft && !progressCopilotOpen ? (
            <div className="fmp-analysis-toggle-dock">
              <button
                type="button"
                className="fmp-ai-action-btn fmp-analysis-toggle-btn"
                onClick={() => setProgressCopilotOpen(true)}
                title={PROGRESS_TRACKING_COPILOT_TITLE}
                aria-label={PROGRESS_TRACKING_COPILOT_TITLE}
              >
                <span
                  className="fmp-ai-action-icon fmp-ai-action-icon--gradient"
                  aria-hidden
                />
                <span className="fmp-ai-action-label">
                  {PROGRESS_TRACKING_COPILOT_TITLE}
                </span>
              </button>
            </div>
          ) : null}
        </div>
        {progressCopilotDraft && progressCopilotOpen ? (
          <aside
            className="fmp-progress-copilot-panel"
            aria-label={PROGRESS_TRACKING_COPILOT_TITLE}
            aria-labelledby="fmp-progress-copilot-panel-title"
          >
            <section className="fmp-progress-copilot-panel__shell">
              <button
                type="button"
                className="fmp-progress-copilot-panel__close"
                onClick={() => setProgressCopilotOpen(false)}
                aria-label={`Close ${PROGRESS_TRACKING_COPILOT_TITLE}`}
              >
                ×
              </button>
              <header className="fmp-progress-copilot-panel__header">
                <h3 id="fmp-progress-copilot-panel-title">
                  {PROGRESS_TRACKING_COPILOT_TITLE}
                </h3>
              </header>
              <div className="fmp-progress-copilot__insights">
                <div className="fmp-progress-copilot__insights-heading">
                  <span className="fmp-progress-copilot__insights-label">
                    <span
                      className="fmp-progress-copilot__insights-icon"
                      aria-hidden
                    />
                    Insights
                  </span>
                </div>
                {progressCopilotChanges.slice(0, 3).map((change) => {
                  const active = change.id === activeProgressChange?.id;
                  const confidence = progressInsightConfidence(change);
                  const improvementText = progressInsightImprovementText(change);
                  return (
                    <div
                      key={change.id}
                      className={`fmp-progress-copilot__insight-card${
                        active ? " is-active" : ""
                      }${change.delta < 0 ? " is-improved" : change.delta > 0 ? " is-increased" : ""}`}
                    >
                      <button
                        type="button"
                        className="fmp-progress-copilot__insight-card-main"
                        aria-label={`${change.narrativeLabel}. ${improvementText}. ${confidence} confidence in this estimate.`}
                        onClick={() => handleProgressChangeSelect(change)}
                      >
                        <div className="fmp-progress-copilot__insight-card-head">
                          <strong>{change.narrativeLabel}</strong>
                          <span
                            className={`fmp-progress-copilot__insight-confidence fmp-progress-copilot__insight-confidence--${confidence.toLowerCase()}`}
                            title={progressInsightConfidenceHint(confidence)}
                          >
                            <span className="fmp-progress-copilot__insight-confidence-label">
                              Confidence
                            </span>
                            <span className="fmp-progress-copilot__insight-confidence-value">
                              {confidence}
                            </span>
                          </span>
                        </div>
                        <span className="fmp-progress-copilot__insight-range">
                          {improvementText}
                        </span>
                      </button>
                      {change.regionInsights.length > 0 ? (
                        <details className="fmp-progress-copilot__insight-areas">
                          <summary>
                            <span className="fmp-progress-copilot__insight-areas-label">
                              Details
                            </span>
                            <InsightAreasChevron />
                          </summary>
                          <div className="fmp-progress-copilot__insight-area-list">
                            {change.regionInsights.map((area) => {
                              const areaActive =
                                active &&
                                activeProgressRegionId === area.regionId;
                              return (
                                <button
                                  key={area.regionId}
                                  type="button"
                                  className={`fmp-progress-copilot__insight-area${
                                    areaActive ? " is-active" : ""
                                  }`}
                                  aria-pressed={areaActive}
                                  aria-label={`${area.label}. ${area.improvementText}.${
                                    areaActive ? " Selected. Click to clear highlight." : ""
                                  }`}
                                  onClick={() =>
                                    handleProgressRegionSelect(
                                      change,
                                      area.regionId,
                                    )
                                  }
                                >
                                  <span>{area.label}</span>
                                  <span>{area.improvementText}</span>
                                </button>
                              );
                            })}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="fmp-progress-copilot__treatment-history">
                <span className="fmp-progress-copilot__section-label">
                  Treatment history
                </span>
                <div className="fmp-progress-copilot__treatment-list">
                  {progressCopilotDraft.loggedTreatments.length > 0 ? (
                    progressCopilotDraft.loggedTreatments.map((entry) => {
                      const { name, timing } = parseLoggedTreatmentEntry(entry);
                      return (
                        <div
                          key={entry}
                          className="fmp-progress-copilot__treatment-item"
                        >
                          <strong>{name}</strong>
                          {timing ? <span>{timing}</span> : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="fmp-progress-copilot__treatment-item fmp-progress-copilot__treatment-item--empty">
                      <span>No treatments logged</span>
                    </div>
                  )}
                </div>
              </div>
              <ProgressCopilotSuggestedPlanSection
                detail={progressCopilotDraft.nextStepDetail}
                suggestions={progressCopilotDraft.suggestions}
              />
              {progressCopilotConfig ? (
                <>
                  <button
                    type="button"
                    className="fmp-progress-copilot__adapt-toggle"
                    onClick={() => setAdaptConfigOpen((v) => !v)}
                    aria-expanded={adaptConfigOpen}
                  >
                    <span>
                      {adaptConfigOpen ? "Close story inputs" : "Edit story inputs"}
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      aria-hidden
                      style={{
                        transform: adaptConfigOpen
                          ? "rotate(180deg)"
                          : "none",
                        transition: "transform 0.18s",
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {adaptConfigOpen ? (
                    <section
                      className="fmp-progress-copilot__configure"
                      aria-label={`Adapt ${PROGRESS_TRACKING_COPILOT_TITLE} inputs`}
                    >
                      <div className="fmp-progress-copilot__adapt-field">
                        <span className="fmp-progress-copilot__section-label">Patient goal</span>
                        <div className="fmp-progress-copilot__goal-presets">
                          {PROGRESS_COPILOT_GOAL_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              className={`fmp-progress-copilot__goal-preset${
                                progressCopilotConfig.goal.trim() === preset
                                  ? " is-active"
                                  : ""
                              }`}
                              onClick={() =>
                                updateProgressCopilotConfig({ goal: preset })
                              }
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                        <details className="fmp-progress-copilot__custom-goal">
                          <summary>Use a custom goal</summary>
                          <textarea
                            className="fmp-progress-copilot__adapt-textarea"
                            value={progressCopilotConfig.goal}
                            rows={2}
                            placeholder="Type the goal the patient said in their own words..."
                            onChange={(event) =>
                              updateProgressCopilotConfig({
                                goal: event.target.value,
                              })
                            }
                          />
                        </details>
                      </div>
                      <div className="fmp-progress-copilot__adapt-field">
                        <span className="fmp-progress-copilot__section-label">Story focus</span>
                        <div className="fmp-progress-copilot__chip-row">
                          {PROGRESS_COPILOT_FOCUS_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              className={`fmp-progress-copilot__chip${
                                progressCopilotConfig.focusMetricKey === option.id
                                  ? " is-active"
                                  : ""
                              }`}
                              onClick={() =>
                                updateProgressCopilotConfig({
                                  focusMetricKey: option.id,
                                })
                              }
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="fmp-progress-copilot__adapt-field">
                        <span className="fmp-progress-copilot__section-label">Prior experience</span>
                        <div className="fmp-progress-copilot__chip-row">
                          {PRIOR_EXPERIENCE_CHIPS.map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              className={`fmp-progress-copilot__chip${
                                isChipActive(
                                  progressCopilotConfig.previousTreatmentContext ?? "",
                                  chip,
                                )
                                  ? " is-active"
                                  : ""
                              }`}
                              onClick={() =>
                                updateProgressCopilotConfig({
                                  previousTreatmentContext: toggleChipInString(
                                    progressCopilotConfig.previousTreatmentContext ?? "",
                                    chip,
                                  ),
                                })
                              }
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      </div>
                      {discussedItemsForCopilot.length > 0 ? (
                        <div className="fmp-progress-copilot__treatment-picker">
                          <span className="fmp-progress-copilot__section-label">
                            Treatments used in story
                          </span>
                          <div className="fmp-progress-copilot__treatment-options">
                            {discussedItemsForCopilot.map((item) => {
                              const checked =
                                progressCopilotConfig.includedTreatmentIds.includes(
                                  item.id,
                              );
                              return (
                                <button
                                  type="button"
                                  key={item.id}
                                  className={`fmp-progress-copilot__treatment-option${
                                    checked ? " is-checked" : ""
                                  }`}
                                  aria-pressed={checked}
                                  onClick={() =>
                                    toggleProgressCopilotTreatment(item.id)
                                  }
                                >
                                  <b aria-hidden>{checked ? "✓" : "+"}</b>
                                  <span>
                                    {progressCopilotTreatmentLabel(item)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                      <div className="fmp-progress-copilot__actions fmp-progress-copilot__actions--configure">
                        <button
                          type="button"
                          className="fmp-progress-copilot__apply"
                          onClick={() =>
                            applyProgressCopilotConfig(progressCopilotConfig)
                          }
                        >
                          Update copilot
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const resetConfig =
                              createDefaultProgressCopilotConfig(
                                analysisOverviewClient,
                                progressCopilotConfig.focusMetricKey,
                              );
                            setProgressCopilotConfig(resetConfig);
                            applyProgressCopilotConfig(resetConfig);
                          }}
                        >
                          Reset inputs
                        </button>
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}
            </section>
          </aside>
        ) : null}
      </div>
    ) : null;

  const placeholderEl = (
    <div className="fmp-placeholder">
      <svg
        width="56"
        height="56"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#999"
        strokeWidth="1.5"
        aria-hidden
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      <p>{mode === "photo" ? "No photo available" : "No 3D preview"}</p>
    </div>
  );

  // --- Render ---
  return (
    <div
      className={`fmp-root${viewportExpanded ? " fmp-root--viewport-expanded" : ""}${useAuraView ? " fmp-root--aura" : ""}`}
    >
      {/* Toolbar: expand always available; Aura collapsed hides extra chrome via CSS */}
      {(has3D || hasPhoto || canRunScanGeneration) &&
        showOverlayToolbar &&
        !hideToolbarForAuraScanConfig &&
        toolbar}

      {/* Upgrade modal: select photos and quality before submitting the scan job. */}
      {GENERATE_3D_SCAN_ENABLED && scanState.phase === "config" && (
        <ScanConfigPanel
          slots={angleSlots}
          selectedPhotoKeys={selectedScanPhotoKeys}
          onSelectedPhotoKeysChange={setSelectedScanPhotoKeys}
          quality={scanQuality}
          onQualityChange={setScanQuality}
          onStart={() => startScan()}
          onCancel={() => setScanState({ phase: "idle" })}
          submitting={false}
          client={analysisOverviewClient}
          patientName={patientName}
          isRegeneration={hasExistingScanAnalysis}
        />
      )}

      <div className="fmp-body">
        {showFsAnalysisOverview && analysisOverviewClient ? (
          <div
            className={`fmp-fullscreen-split${auraPanelCollapsed ? " fmp-fullscreen-split--panel-collapsed" : ""}`}
          >
            {useAuraView && compareViewer ? (
              <div className="fmp-fullscreen-split-3d fmp-fullscreen-split-face fmp-fullscreen-split-face--compare">
                <div className="fmp-fullscreen-split-3d-inner fmp-canvas-area fmp-canvas-area--3d">
                  {compareViewer}
                </div>
              </div>
            ) : useAuraView ? (
              <div className="fmp-fullscreen-split-3d fmp-fullscreen-split-face">
                <div className="fmp-fullscreen-split-3d-inner fmp-canvas-area fmp-canvas-area--3d">
                  <FaceMirrorViewportShell>{viewer3D}</FaceMirrorViewportShell>
                  {analysisToggleDock}
                </div>
              </div>
            ) : mode === "photo" && hasPhoto && activePhotoUrl ? (
              <div className="fmp-fullscreen-split-photo fmp-fullscreen-split-face">
                <div className="fmp-fullscreen-split-photo-inner fmp-canvas-area">
                  <FaceMirrorViewportShell>
                    <FaceMirrorPhotoStage
                      {...photoStageProps}
                      wrapClassName="fmp-photo-stage--in-expanded-split"
                    />
                  </FaceMirrorViewportShell>
                  {analysisToggleDock}
                </div>
              </div>
            ) : mode === "3d" && effectiveVideoUrl ? (
              <div className="fmp-fullscreen-split-3d fmp-fullscreen-split-face">
                <div className="fmp-fullscreen-split-3d-inner fmp-canvas-area fmp-canvas-area--3d">
                  <FaceMirrorViewportShell>{viewer3D}</FaceMirrorViewportShell>
                  {analysisToggleDock}
                </div>
              </div>
            ) : (
              <div className="fmp-fullscreen-split-placeholder fmp-canvas-area fmp-fullscreen-split-face">
                <div className="fmp-placeholder">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#999"
                    strokeWidth="1.5"
                    aria-hidden
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <p>
                    {mode === "photo" ? "No photo available" : "No 3D preview"}
                  </p>
                </div>
              </div>
            )}
            <div
              className={`fmp-fullscreen-split-overview${overviewSoloSpan ? " fmp-fullscreen-split-overview--solo" : ""}`}
            >
              <div className="fmp-fullscreen-split-overview-main">
                <AnalysisOverviewModal
                  embedded
                  client={analysisOverviewClient}
                  onClose={() => setViewportExpanded(false)}
                  onAddToPlanDirect={analysisOverviewOnAddToPlanDirect}
                  auraBridge={auraBridge}
                  onOpenTreatmentRecommender={
                    handleOpenEmbeddedTreatmentRecommender
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`fmp-canvas-area${mode === "3d" && has3D ? " fmp-canvas-area--3d" : ""}`}
          >
            {useAuraView ? (
              <FaceMirrorViewportShell>{viewer3D}</FaceMirrorViewportShell>
            ) : (
              mode === "photo" &&
              (hasPhoto && activePhotoUrl ? (
                <FaceMirrorViewportShell>
                  <FaceMirrorPhotoStage {...photoStageProps} />
                </FaceMirrorViewportShell>
              ) : (
                placeholderEl
              ))
            )}
            {!useAuraView && mode === "3d" && has3D && (
              <FaceMirrorViewportShell>{viewer3D}</FaceMirrorViewportShell>
            )}
            {analysisToggleDock}
          </div>
        )}
      </div>
    </div>
  );
}
