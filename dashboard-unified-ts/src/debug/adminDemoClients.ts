/**
 * Demo patients for the Admin provider in development.
 * Emily Dunhill, Allison Baum, and Tanya Tan include facial analysis data + 3D model references
 * (see `src/utils/client3dConfig.ts` for the name→GLB mapping).
 * Tanya Tan is the full demo showcase: Aura turntable, analysis overview, severity scores,
 * completed skincare quiz (Amber) with AM/PM routine, and treatment plan items.
 *
 * Only injected when:
 *  1. The logged-in provider is Admin (code "admin" or "password", or display name "Admin"), AND
 *  2. Injection is enabled (always on for Admin provider unless VITE_ADMIN_DEMO_CLIENTS=false).
 */

import type {
  AnalysisSeverityIssue,
  Client,
  DiscussedItem,
  AnalysisSeverityScoresData,
  ClientFacialAnalysisScan,
  DemoFacialAnalysisAi,
  Provider,
} from "../types";
import { isAdminBlueprintProvider } from "../utils/providerHelpers";
import { ADMIN_DEMO_SKINCARE_QUIZ } from "./adminDemoSkincareQuiz";
import {
  TANYA_TAN_GALLERY_PHOTO_SLOTS,
  TANYA_TAN_VIEWER_ANGLE_ASSETS,
  type AuraTanViewAngle,
} from "../utils/auraTanAnglePhotos";
import type { PatientAuraAssetManifest } from "../utils/patientAuraAssets";
import { demo3dAssetUrl } from "../utils/demoAssetUrls";
import tanyaTanSeverityScoresJson from "./tanya-tan-severity-scores.json";
import tanyaTanAnalysisAiJson from "./tanya-tan-analysis-ai.json";

const TANYA_TAN_SEVERITY =
  tanyaTanSeverityScoresJson as AnalysisSeverityScoresData;
const TANYA_TAN_ANALYSIS_AI = tanyaTanAnalysisAiJson as DemoFacialAnalysisAi;
const TANYA_TAN_TURNTABLE_URL = demo3dAssetUrl(
  "tanya-tan/tanya-tan-turntable-pigmentation.mp4",
);

function progressAngleTimeRatio(angle: AuraTanViewAngle): number {
  return angle === "profile-left"
    ? 0.99
    : angle === "three-quarter-left"
      ? 0.76
      : angle === "front"
        ? 0.5
        : angle === "three-quarter-right"
          ? 0.24
          : 0;
}

function progressAngleLabel(angle: AuraTanViewAngle): string {
  return angle === "profile-left"
    ? "Left profile"
    : angle === "three-quarter-left"
      ? "Left three-quarter"
      : angle === "front"
        ? "Front"
        : angle === "three-quarter-right"
          ? "Right three-quarter"
          : "Right profile";
}

function tanyaProgressBeforePhotoUrl(angle: AuraTanViewAngle): string {
  return (
    TANYA_TAN_GALLERY_PHOTO_SLOTS.find((slot) => slot.id === angle)?.url ??
    demo3dAssetUrl("tanya-tan-front.png")
  );
}

function tanyaProgressBeforePhotoSlots(
  angles: AuraTanViewAngle[],
): NonNullable<Client["galleryPhotoSlots"]> {
  return angles.map((angle) => ({
    id: angle,
    label: progressAngleLabel(angle),
    url: tanyaProgressBeforePhotoUrl(angle),
  }));
}

function tanyaProgressBeforeAuraManifest(
  angles: AuraTanViewAngle[],
): PatientAuraAssetManifest {
  return tanyaProgressAuraManifest("before", angles);
}

function tanyaProgressAuraAssetUrl(
  angle: AuraTanViewAngle,
  variant:
    | "color"
    | "rembg"
    | "texture-cutout"
    | "pigmentation-cutout"
    | "redness-cutout"
    | "pores-cutout"
    | "wrinkles-view",
): string {
  const asset = TANYA_TAN_VIEWER_ANGLE_ASSETS[angle];
  switch (variant) {
    case "color":
      return asset.srcOriginal ?? asset.src;
    case "rembg":
      return asset.srcCutout ?? asset.src;
    case "texture-cutout":
      return asset.srcTexture ?? asset.src;
    case "pigmentation-cutout":
      return asset.srcPigmentation ?? asset.srcTexture ?? asset.src;
    case "redness-cutout":
      return asset.srcRedness ?? asset.src;
    case "pores-cutout":
      return asset.srcPores ?? asset.srcTexture ?? asset.src;
    case "wrinkles-view":
      return asset.srcWrinklesView ?? asset.srcWrinkles ?? asset.src;
  }
}

function tanyaProgressAuraPhotoSlots(
  angles: AuraTanViewAngle[],
): NonNullable<Client["galleryPhotoSlots"]> {
  return angles.map((angle) => ({
    id: angle,
    label: progressAngleLabel(angle),
    url: tanyaProgressAuraAssetUrl(angle, "color"),
  }));
}

type TanyaProgressAngleFraming = Pick<
  NonNullable<PatientAuraAssetManifest["angles"]["front"]>,
  "cssTransform" | "initialPanX" | "initialPanY"
>;

const TANYA_PROGRESS_ANGLE_FRAMING: Record<
  "before" | "after",
  Partial<Record<AuraTanViewAngle, TanyaProgressAngleFraming>>
> = {
  before: {
    front: {
      cssTransform: "translate(0px, -6px) scale(0.98)",
      initialPanX: 0,
      initialPanY: 0,
    },
  },
  after: {
    front: {
      cssTransform: "translate(0px, -60px) scale(1.08)",
      initialPanX: 0,
      initialPanY: 0,
    },
  },
};

function tanyaProgressAuraManifest(
  scan: "before" | "after",
  angles: AuraTanViewAngle[],
): PatientAuraAssetManifest {
  return {
    turntableVideoUrl: TANYA_TAN_TURNTABLE_URL,
    textureVideoUrl: TANYA_TAN_TURNTABLE_URL,
    pigmentationVideoUrl: TANYA_TAN_TURNTABLE_URL,
    rednessVideoUrl: TANYA_TAN_TURNTABLE_URL,
    poresVideoUrl: TANYA_TAN_TURNTABLE_URL,
    wrinklesVideoUrl: TANYA_TAN_TURNTABLE_URL,
    availableViewAngles: angles,
    angles: Object.fromEntries(
      angles.map((angle) => {
        const src = tanyaProgressAuraAssetUrl(angle, "rembg");
        const framing = TANYA_PROGRESS_ANGLE_FRAMING[scan][angle];
        return [
          angle,
          {
            src,
            srcOriginal: tanyaProgressAuraAssetUrl(angle, "color"),
            srcCutout: src,
            srcTexture: tanyaProgressAuraAssetUrl(
              angle,
              "texture-cutout",
            ),
            srcPigmentation: tanyaProgressAuraAssetUrl(
              angle,
              "pigmentation-cutout",
            ),
            srcRedness: tanyaProgressAuraAssetUrl(
              angle,
              "redness-cutout",
            ),
            srcPores: tanyaProgressAuraAssetUrl(angle, "pores-cutout"),
            srcWrinklesView: tanyaProgressAuraAssetUrl(
              angle,
              "wrinkles-view",
            ),
            timeRatio: progressAngleTimeRatio(angle),
            label: progressAngleLabel(angle),
            fromPhoto: true,
            cssTransform:
              framing?.cssTransform ?? "translate(0px, 0px) scale(1)",
            photoZoom: 1,
            initialPanX: framing?.initialPanX ?? 0,
            initialPanY: framing?.initialPanY ?? 0,
          },
        ];
      }),
    ) as PatientAuraAssetManifest["angles"],
  };
}

function progressSeverityLevel(severity: number): string {
  if (severity >= 0.55) return "moderate";
  if (severity >= 0.35) return "mild-moderate";
  return "mild";
}

function progressSeverityRow(
  name: string,
  severity: number,
  level = progressSeverityLevel(severity),
): [string, AnalysisSeverityIssue] {
  const clamped = Math.max(0.08, Math.min(0.99, severity));
  return [
    name,
    {
      predicted: true,
      probability: Math.max(0.1, Math.min(0.99, clamped + 0.18)),
      severity: clamped,
      severity_normalized_0_1: clamped,
      severity_level: level,
      source: "admin_progress_demo",
      model_used: "Progress demo fixture",
    },
  ];
}

/**
 * Volume findings for the progress-tracking demo patient (Anita Desai).
 * Primary concerns are skin quality; volume loss is early and midface-led —
 * under-eye hollowing, mild cheek flattening, and early nasolabial folds.
 * Neck stays clear at this age for this profile.
 */
function progressVolumeSeverityIssues(
  volume: number,
): Array<[string, number]> {
  const issues: Array<[string, number]> = [
    ["Under Eye Hollow", Math.min(0.95, volume * 1.05)],
    ["Mid Cheek Flattening", volume],
    ["Nasolabial Folds", volume * 0.92],
  ];
  if (volume >= 0.27) {
    issues.push(["Temporal Hollow", volume * 0.88]);
    issues.push(["Marionette Lines", volume * 0.78]);
  }
  return issues;
}

/**
 * Structure findings for the progress-tracking demo patient.
 * Mild jawline softening only — not a structure-led case. Brow, nose, and
 * lips stay strong; no jowl or lip thinning flags at this severity band.
 */
function progressStructureSeverityIssues(
  structure: number,
): Array<[string, number]> {
  const issues: Array<[string, number]> = [
    ["Ill-Defined Jawline", structure],
  ];
  if (structure >= 0.19) {
    issues.push(["Asymmetric Jawline", structure * 0.82]);
  }
  return issues;
}

function progressSeverity(
  submissionId: string,
  values: {
    pigmentation: number;
    redness: number;
    pores: number;
    wrinkles: number;
    volume: number;
    structure: number;
  },
): AnalysisSeverityScoresData {
  const { pigmentation, redness, pores, wrinkles, volume, structure } = values;
  const rows: Array<[string, number, string?]> = [
    ["Dark Spots", pigmentation],
    ["Facial Redness", redness],
    ["Enlarged Pores", pores],
    ["Fine Lines", wrinkles],
    ...progressVolumeSeverityIssues(volume),
    ...progressStructureSeverityIssues(structure),
  ];
  return {
    schema_version: 4,
    detector_type: "admin_progress_demo",
    submission_id: submissionId,
    issues: Object.fromEntries(
      rows.map(([name, severity, level]) =>
        progressSeverityRow(name, severity, level),
      ),
    ),
  };
}

function progressScan(input: {
  id: string;
  label: string;
  dateIso: string;
  photoSlots: NonNullable<Client["galleryPhotoSlots"]>;
  auraManifest: PatientAuraAssetManifest;
  severity: ReturnType<typeof progressSeverity>;
  metrics: NonNullable<ClientFacialAnalysisScan["metrics"]>;
}): ClientFacialAnalysisScan {
  return {
    id: input.id,
    label: input.label,
    dateIso: input.dateIso,
    photoSlots: input.photoSlots,
    turntableVideoUrl: TANYA_TAN_TURNTABLE_URL,
    auraManifest: input.auraManifest,
    severityScores: input.severity,
    metrics: input.metrics,
  };
}

/** Issue labels with predicted=true from Modal severity run, highest badness first. */
const TANYA_TAN_DETECTED_ISSUES = Object.entries(
  TANYA_TAN_SEVERITY.issues ?? {},
)
  .filter(([, row]) => row.predicted)
  .sort(
    (a, b) =>
      (b[1].severity_normalized_0_1 ?? 0) - (a[1].severity_normalized_0_1 ?? 0),
  )
  .map(([name]) => name)
  .join(", ");

/** Kept for compatibility with older imports; demo clients no longer receive name suffixes. */
export const ADMIN_DEMO_NAME_COLLISION_SUFFIX = "";

function item(
  partial: Partial<DiscussedItem> & Pick<DiscussedItem, "id" | "treatment">,
): DiscussedItem {
  return partial as DiscussedItem;
}

function baseClient(
  overrides: Partial<Client> & Pick<Client, "id" | "name">,
): Client {
  const now = new Date().toISOString();
  return {
    email: `${overrides.id}@demo.admin.local`,
    phone: "+1 555 000 0000",
    zipCode: "10001",
    age: null,
    ageRange: null,
    dateOfBirth: null,
    goals: [],
    wellnessGoals: [],
    concerns: "",
    areas: [],
    aestheticGoals: "",
    skinType: "Normal",
    skinTone: "Medium",
    ethnicBackground: null,
    engagementLevel: null,
    casesViewedCount: null,
    totalCasesAvailable: null,
    concernsExplored: null,
    photosLiked: 0,
    photosViewed: 0,
    treatmentsViewed: [],
    source: "Patients",
    status: "scheduled",
    priority: "medium",
    createdAt: now,
    notes: "Demo patient — not synced to Airtable.",
    appointmentDate: null,
    treatmentReceived: null,
    revenue: null,
    lastContact: now,
    isReal: false,
    tableSource: "Patients",
    facialAnalysisStatus: "complete",
    frontPhoto: null,
    frontPhotoLoaded: false,
    allIssues: "",
    interestedIssues: "",
    whichRegions: "",
    skinComplaints: "",
    processedAreasOfInterest: "",
    areasOfInterestFromForm: "",
    archived: false,
    offerClaimed: false,
    offerExpirationDate: null,
    locationName: "Admin (demo)",
    appointmentStaffName: null,
    contactHistory: [],
    ...overrides,
  };
}

const EMILY_SEVERITY: AnalysisSeverityScoresData = {
  schema_version: 1,
  detector_type: "multi_region",
  submission_id: "admin-demo-emily",
  issues: {
    "Forehead Wrinkles": {
      predicted: true,
      probability: 0.89,
      severity: 2,
      severity_normalized_0_1: 0.61,
      severity_level: "moderate",
    },
    "Crow's Feet": {
      predicted: true,
      probability: 0.82,
      severity: 2,
      severity_normalized_0_1: 0.55,
      severity_level: "moderate",
    },
    "Under Eye Hollowing": {
      predicted: true,
      probability: 0.77,
      severity: 2,
      severity_normalized_0_1: 0.51,
      severity_level: "mild-moderate",
    },
    "Nasolabial Folds": {
      predicted: true,
      probability: 0.73,
      severity: 2,
      severity_normalized_0_1: 0.48,
      severity_level: "mild-moderate",
    },
  },
};

const ALLISON_SEVERITY: AnalysisSeverityScoresData = {
  schema_version: 1,
  detector_type: "multi_region",
  submission_id: "admin-demo-allison",
  issues: {
    "Cheek Volume Loss": {
      predicted: true,
      probability: 0.91,
      severity: 3,
      severity_normalized_0_1: 0.68,
      severity_level: "moderate-severe",
    },
    "Marionette Lines": {
      predicted: true,
      probability: 0.85,
      severity: 2,
      severity_normalized_0_1: 0.58,
      severity_level: "moderate",
    },
    "Lip Thinning": {
      predicted: true,
      probability: 0.79,
      severity: 2,
      severity_normalized_0_1: 0.52,
      severity_level: "mild-moderate",
    },
    "Jawline Definition": {
      predicted: true,
      probability: 0.72,
      severity: 2,
      severity_normalized_0_1: 0.47,
      severity_level: "mild-moderate",
    },
  },
};

const MORGAN_SEVERITY: AnalysisSeverityScoresData = {
  schema_version: 1,
  detector_type: "multi_region",
  submission_id: "admin-demo-morgan",
  issues: {
    "Facial Redness": {
      predicted: true,
      probability: 0.88,
      severity: 2,
      severity_normalized_0_1: 0.62,
      severity_level: "moderate",
    },
    "Enlarged Pores": {
      predicted: true,
      probability: 0.81,
      severity: 2,
      severity_normalized_0_1: 0.54,
      severity_level: "moderate",
    },
    "Acne / Breakouts": {
      predicted: true,
      probability: 0.74,
      severity: 2,
      severity_normalized_0_1: 0.48,
      severity_level: "mild-moderate",
    },
    "Uneven Skin Texture": {
      predicted: true,
      probability: 0.69,
      severity: 1,
      severity_normalized_0_1: 0.38,
      severity_level: "mild",
    },
  },
};

type SampleSeverityIssue = {
  name: string;
  probability: number;
  severity: number;
  level: string;
};

function sampleSeverity(
  submission_id: string,
  issues: SampleSeverityIssue[],
): AnalysisSeverityScoresData {
  return {
    schema_version: 4,
    detector_type: "local_gcp_pipeline_sample",
    severity_normalized_scale: "0_to_1",
    submission_id,
    issues: Object.fromEntries(
      issues.map((issue) => [
        issue.name,
        {
          predicted: true,
          probability: issue.probability,
          severity: issue.severity,
          severity_normalized_0_1: issue.severity,
          severity_normalization_method: "severity_0_to_1",
          severity_level: issue.level,
          source: "local_sample_pipeline",
          model_used: "GCP Aura still pipeline",
        },
      ]),
    ),
  } as AnalysisSeverityScoresData;
}

function sampleAuraPhotoSlots(
  slug: string,
  angles: Array<
    | "profile-left"
    | "three-quarter-left"
    | "front"
    | "three-quarter-right"
    | "profile-right"
  >,
): NonNullable<Client["galleryPhotoSlots"]> {
  const labels: Record<(typeof angles)[number], string> = {
    "profile-left": "Left profile",
    "three-quarter-left": "Left three-quarter",
    front: "Front",
    "three-quarter-right": "Right three-quarter",
    "profile-right": "Right profile",
  };
  return angles.map((angle) => ({
    id: angle,
    label: labels[angle],
    url: demo3dAssetUrl(`${slug}/${slug}-${angle}-color.png`),
  }));
}

function sampleAuraClient({
  id,
  name,
  slug,
  age,
  ageRange,
  skinTone,
  aestheticGoals,
  skinComplaints,
  issues,
  angles,
}: {
  id: string;
  name: string;
  slug: string;
  age: number;
  ageRange: string;
  skinTone: string;
  aestheticGoals: string;
  skinComplaints: string;
  issues: SampleSeverityIssue[];
  angles: Parameters<typeof sampleAuraPhotoSlots>[1];
}): Client {
  const issueNames = issues.map((issue) => issue.name).join(", ");
  return baseClient({
    id,
    name,
    age,
    ageRange,
    phone: "+1 555 312 8890",
    frontPhoto: demo3dAssetUrl(`${slug}/${slug}-front-color.png`),
    frontPhotoLoaded: true,
    auraManifestUrl: demo3dAssetUrl(`${slug}/${slug}-aura-manifest.json`),
    galleryPhotoSlots: sampleAuraPhotoSlots(slug, angles),
    interestedIssues: "",
    allIssues: issueNames,
    skinType: "Combination",
    skinTone,
    skinComplaints,
    aestheticGoals,
    severityScoresFromAnalyses: sampleSeverity(id, issues),
    discussedItems: [],
    notes:
      "Admin sample patient generated locally from ~/Documents/sample_patients using the updated Aura still pipeline.",
  });
}

export function getAdminDemoClients(): Client[] {
  const progressJulySeverity = progressSeverity(
    "admin-demo-progress-july-2026",
    {
      pigmentation: 0.62,
      redness: 0.48,
      pores: 0.44,
      wrinkles: 0.3,
      volume: 0.28,
      structure: 0.22,
    },
  );
  const progressSeptemberSeverity = progressSeverity(
    "admin-demo-progress-september-2026",
    {
      pigmentation: 0.38,
      redness: 0.27,
      pores: 0.34,
      wrinkles: 0.26,
      volume: 0.25,
      structure: 0.2,
    },
  );
  const progressJulyAngles: AuraTanViewAngle[] = [
    "profile-left",
    "front",
    "profile-right",
  ];
  const progressJulyPhotoSlots =
    tanyaProgressBeforePhotoSlots(progressJulyAngles);
  const progressSeptemberPhotoSlots =
    tanyaProgressAuraPhotoSlots(progressJulyAngles);

  return [
    baseClient({
      id: "admin-demo-progress-tracking",
      name: "Anita Desai",
      age: 42,
      ageRange: "40-49",
      phone: "+1 555 312 8826",
      createdAt: "2026-09-01T16:00:00.000Z",
      lastContact: "2026-09-01T16:00:00.000Z",
      frontPhoto: demo3dAssetUrl("tanya-tan-front.png"),
      frontPhotoLoaded: true,
      galleryPhotoSlots: progressSeptemberPhotoSlots,
      turntableVideoUrl: TANYA_TAN_TURNTABLE_URL,
      interestedIssues:
        "Dark Spots, Facial Redness, Enlarged Pores, Fine Lines, Under Eye Hollow, Mid Cheek Flattening, Nasolabial Folds, Ill-Defined Jawline",
      allIssues:
        "Dark Spots, Facial Redness, Enlarged Pores, Fine Lines, Under Eye Hollow, Mid Cheek Flattening, Nasolabial Folds, Ill-Defined Jawline",
      skinType: "Combination",
      skinTone: "Medium",
      skinComplaints:
        "Pigmentation, post-treatment redness, visible pores, and early fine lines",
      aestheticGoals:
        "look clearer and more even-toned with less visible dark spotting before an upcoming event",
      treatmentReceived:
        "HydraFacial, OTC vitamin C, retinol, and inconsistent daily SPF before this pigment plan",
      severityScoresFromAnalyses: progressSeptemberSeverity,
      progressScans: [
        progressScan({
          id: "admin-demo-progress-2026-07-01",
          label: "July 1, 2026 scan",
          dateIso: "2026-07-01T16:00:00.000Z",
          photoSlots: progressJulyPhotoSlots,
          auraManifest: tanyaProgressBeforeAuraManifest(progressJulyAngles),
          severity: progressJulySeverity,
          metrics: {
            pigmentation: 62,
            redness: 48,
            pores: 44,
            wrinkles: 30,
            volume: 28,
            structure: 22,
          },
        }),
        progressScan({
          id: "admin-demo-progress-2026-09-01",
          label: "September 1, 2026 scan",
          dateIso: "2026-09-01T16:00:00.000Z",
          photoSlots: progressSeptemberPhotoSlots,
          auraManifest: tanyaProgressAuraManifest("after", progressJulyAngles),
          severity: progressSeptemberSeverity,
          metrics: {
            pigmentation: 38,
            redness: 27,
            pores: 34,
            wrinkles: 26,
            volume: 25,
            structure: 20,
          },
        }),
      ],
      discussedItems: [
        item({
          id: "admin-progress-d1",
          treatment: "Chemical Peel",
          product: "Depigmentation peel",
          interest: "Dark Spots",
          findings: ["Dark Spots", "Facial Redness"],
          region: "Full Face",
          timeline: "Completed",
          quantity: "2",
          completedAt: "2026-08-15T18:00:00.000Z",
        }),
        item({
          id: "admin-progress-d2",
          treatment: "Skincare",
          product:
            "SkinCeuticals Discoloration Defense | Targeted Serum for Dark Spots & Uneven Skin Tone",
          interest: "Dark Spots",
          findings: ["Dark Spots"],
          region: "Full face",
          timeline: "Now",
          quantity: "1",
        }),
      ],
      notes:
        "Admin demo patient for testing Progress Tracking: open expanded analysis, switch to Scans, click Compare (defaults to the two latest scans), then change scan dates from the compare view if needed. July uses the uploaded Tanya before photos; September uses the existing processed Tanya scan assets.",
    }),

    sampleAuraClient({
      id: "admin-demo-sample-czarina",
      name: "Czarina Esparza",
      slug: "sample-czarina-esparza",
      age: 34,
      ageRange: "30-39",
      skinTone: "Medium",
      aestheticGoals:
        "Review skin tone, pores, and side-profile texture with the updated Aura image pipeline",
      skinComplaints: "Pigmentation, redness, pores, and uneven texture",
      angles: [
        "profile-left",
        "three-quarter-left",
        "front",
        "three-quarter-right",
        "profile-right",
      ],
      issues: [
        {
          name: "Dark Spots",
          probability: 0.82,
          severity: 0.58,
          level: "moderate",
        },
        {
          name: "Facial Redness",
          probability: 0.73,
          severity: 0.42,
          level: "mild-moderate",
        },
        {
          name: "Enlarged Pores",
          probability: 0.76,
          severity: 0.5,
          level: "moderate",
        },
        {
          name: "Uneven Skin Texture",
          probability: 0.68,
          severity: 0.38,
          level: "mild",
        },
      ],
    }),

    sampleAuraClient({
      id: "admin-demo-sample-julio",
      name: "Julio Sample",
      slug: "sample-julio",
      age: 39,
      ageRange: "30-39",
      skinTone: "Medium",
      aestheticGoals:
        "Validate the updated pipeline on a male face with facial hair and bilateral profile photos",
      skinComplaints:
        "Redness, pores, under-eye texture, and early expression lines",
      angles: ["profile-left", "front", "profile-right"],
      issues: [
        {
          name: "Facial Redness",
          probability: 0.78,
          severity: 0.46,
          level: "mild-moderate",
        },
        {
          name: "Enlarged Pores",
          probability: 0.7,
          severity: 0.4,
          level: "mild-moderate",
        },
        {
          name: "Under Eye Wrinkles",
          probability: 0.64,
          severity: 0.34,
          level: "mild",
        },
        {
          name: "Nasolabial Folds",
          probability: 0.62,
          severity: 0.32,
          level: "mild",
        },
      ],
    }),

    sampleAuraClient({
      id: "admin-demo-sample-snigdha",
      name: "Snigdha Sample",
      slug: "sample-snigdha",
      age: 28,
      ageRange: "20-29",
      skinTone: "Medium",
      aestheticGoals:
        "Inspect generated pigmentation, redness, pore, and wrinkle stills across available angles",
      skinComplaints:
        "Mild pigmentation, pores, redness, and texture variation",
      angles: ["profile-left", "front", "three-quarter-right", "profile-right"],
      issues: [
        {
          name: "Dark Spots",
          probability: 0.72,
          severity: 0.4,
          level: "mild-moderate",
        },
        { name: "Red Spots", probability: 0.68, severity: 0.35, level: "mild" },
        {
          name: "Enlarged Pores",
          probability: 0.7,
          severity: 0.38,
          level: "mild",
        },
        {
          name: "Fine Lines",
          probability: 0.58,
          severity: 0.26,
          level: "mild",
        },
      ],
    }),

    baseClient({
      id: "admin-demo-morgan",
      name: "Morgan Westmoreland",
      age: 42,
      ageRange: "40-49",
      phone: "+1 555 312 8804",
      frontPhoto: demo3dAssetUrl(
        "morgan-westmoreland/morgan-westmoreland-front-color.jpg",
      ),
      frontPhotoLoaded: true,
      auraManifestUrl: demo3dAssetUrl(
        "morgan-westmoreland/morgan-westmoreland-aura-manifest.json",
      ),
      galleryPhotoSlots: [
        {
          id: "profile-left",
          label: "Left profile",
          url: demo3dAssetUrl(
            "morgan-westmoreland/morgan-westmoreland-profile-left-color.jpg",
          ),
        },
        {
          id: "three-quarter-left",
          label: "Left three-quarter",
          url: demo3dAssetUrl(
            "morgan-westmoreland/morgan-westmoreland-three-quarter-left-color.jpg",
          ),
        },
        {
          id: "front",
          label: "Front",
          url: demo3dAssetUrl(
            "morgan-westmoreland/morgan-westmoreland-front-color.jpg",
          ),
        },
        {
          id: "three-quarter-right",
          label: "Right three-quarter",
          url: demo3dAssetUrl(
            "morgan-westmoreland/morgan-westmoreland-three-quarter-right-color.jpg",
          ),
        },
        {
          id: "profile-right",
          label: "Right profile",
          url: demo3dAssetUrl(
            "morgan-westmoreland/morgan-westmoreland-profile-right-color.jpg",
          ),
        },
      ],
      interestedIssues:
        "Facial Redness, Enlarged Pores, Acne / Breakouts, Uneven Skin Texture",
      allIssues:
        "Facial Redness, Enlarged Pores, Acne / Breakouts, Uneven Skin Texture",
      skinType: "Combination",
      skinTone: "Medium-Fair",
      aestheticGoals: "Reduce redness and improve skin texture and tone",
      severityScoresFromAnalyses: MORGAN_SEVERITY,
      discussedItems: [
        item({
          id: "admin-morgan-d1",
          treatment: "IPL / Photofacial",
          interest: "Facial Redness",
          findings: ["Facial Redness", "Uneven Skin Texture"],
          region: "Full Face",
          timeline: "Now",
          quantity: "3",
        }),
        item({
          id: "admin-morgan-d2",
          treatment: "Chemical Peel",
          interest: "Enlarged Pores",
          findings: ["Enlarged Pores", "Acne / Breakouts"],
          region: "Full Face",
          timeline: "Now",
          quantity: "1",
        }),
        item({
          id: "admin-morgan-d3",
          treatment: "Skincare",
          interest: "Facial Redness",
          findings: ["Facial Redness"],
          region: "Full face",
          timeline: "Now",
          quantity: "1",
        }),
      ],
    }),

    baseClient({
      id: "admin-demo-emily",
      name: "Emily Dunhill",
      age: 44,
      ageRange: "40-49",
      phone: "+1 555 312 8801",
      frontPhoto: demo3dAssetUrl("emily-dunhill-photo.jpg"),
      frontPhotoLoaded: true,
      galleryPhotoSlots: [
        {
          id: "front",
          label: "Front",
          url: demo3dAssetUrl("emily-dunhill-photo.jpg"),
        },
        {
          id: "left",
          label: "Left profile",
          url: demo3dAssetUrl("emily-dunhill-photo-left.jpg"),
        },
        {
          id: "right",
          label: "Right profile",
          url: demo3dAssetUrl("emily-dunhill-photo-right.jpg"),
        },
      ],
      interestedIssues:
        "Forehead Wrinkles, Crow's Feet, Under Eye Hollowing, Nasolabial Folds",
      allIssues:
        "Forehead Wrinkles, Crow's Feet, Under Eye Hollowing, Nasolabial Folds",
      skinType: "Combination",
      skinTone: "Medium",
      aestheticGoals: "Refresh and natural rejuvenation",
      severityScoresFromAnalyses: EMILY_SEVERITY,
      discussedItems: [
        item({
          id: "admin-emily-d1",
          treatment: "Botox",
          interest: "Forehead Wrinkles",
          findings: ["Forehead Wrinkles", "Crow's Feet"],
          region: "Forehead",
          timeline: "Now",
          quantity: "30",
        }),
        item({
          id: "admin-emily-d2",
          treatment: "Hyaluronic Acid Filler",
          interest: "Under Eye Hollowing",
          findings: ["Under Eye Hollowing"],
          region: "Under Eyes",
          timeline: "Now",
          quantity: "1",
        }),
        item({
          id: "admin-emily-d3",
          treatment: "Sculptra",
          interest: "Nasolabial Folds",
          findings: ["Nasolabial Folds"],
          region: "Mid-face",
          timeline: "Add next visit",
          quantity: "1",
        }),
      ],
    }),

    baseClient({
      id: "admin-demo-tanya",
      name: "Tanya Tan",
      age: 38,
      ageRange: "30-39",
      phone: "+1 555 312 8803",
      frontPhoto: demo3dAssetUrl("tanya-tan-front.png"),
      frontPhotoLoaded: true,
      galleryPhotoSlots: TANYA_TAN_GALLERY_PHOTO_SLOTS,
      interestedIssues: "",
      allIssues: TANYA_TAN_DETECTED_ISSUES,
      skinType: "Combination",
      skinTone: "Medium",
      skinComplaints:
        "Uneven pigment, early fine lines, mild texture changes, and occasional dryness",
      aestheticGoals:
        "Brighten uneven tone and build a prevention-focused skin quality plan",
      severityScoresFromAnalyses: TANYA_TAN_SEVERITY,
      demoFacialAnalysisAi: TANYA_TAN_ANALYSIS_AI,
      skincareQuiz: ADMIN_DEMO_SKINCARE_QUIZ,
      discussedItems: [
        item({
          id: "admin-tanya-d1",
          treatment: "Chemical Peel",
          product: "Depigmentation peel",
          interest: "Dark Spots",
          findings: ["Dark Spots", "Red Spots", "Uneven skin tone"],
          region: "Full Face",
          timeline: "Now",
          quantity: "1",
          planQuoteRole: "core",
        }),
        item({
          id: "admin-tanya-d2",
          treatment: "Microneedling",
          product: "PDGF with microneedling",
          interest: "Uneven skin texture",
          findings: ["Blackheads", "Whiteheads", "Fine Lines"],
          region: "Face",
          timeline: "Add next visit",
          quantity: "3",
          planQuoteRole: "core",
        }),
        item({
          id: "admin-tanya-d3",
          treatment: "Skincare",
          product:
            "SkinCeuticals Discoloration Defense | Targeted Serum for Dark Spots & Uneven Skin Tone",
          interest: "Dark Spots",
          findings: ["Dark Spots", "Uneven skin tone"],
          region: "Full face",
          timeline: "Now",
          quantity: "1",
          planQuoteRole: "core",
        }),
        item({
          id: "admin-tanya-d4",
          treatment: "Neurotoxin",
          product: "Botox",
          interest: "Forehead Wrinkles",
          findings: ["Forehead Wrinkles", "Crow's Feet Wrinkles"],
          region: "Forehead",
          timeline: "Wishlist",
          quantity: "16",
          planQuoteRole: "core",
        }),
      ],
    }),

    baseClient({
      id: "admin-demo-allison",
      name: "Allison Baum",
      age: 52,
      ageRange: "50-59",
      phone: "+1 555 312 8802",
      frontPhoto: demo3dAssetUrl("allison-baum-photo.jpg"),
      frontPhotoLoaded: true,
      galleryPhotoSlots: [
        {
          id: "front",
          label: "Front",
          url: demo3dAssetUrl("allison-baum-photo.jpg"),
        },
        {
          id: "left",
          label: "Left profile",
          url: demo3dAssetUrl("allison-baum-photo-left.jpg"),
        },
        {
          id: "right",
          label: "Right profile",
          url: demo3dAssetUrl("allison-baum-photo-right.jpg"),
        },
      ],
      interestedIssues:
        "Cheek Volume Loss, Marionette Lines, Lip Thinning, Jawline Definition",
      allIssues:
        "Cheek Volume Loss, Marionette Lines, Lip Thinning, Jawline Definition",
      skinType: "Dry",
      skinTone: "Fair-Medium",
      aestheticGoals: "Volume restoration and lower face rejuvenation",
      severityScoresFromAnalyses: ALLISON_SEVERITY,
      discussedItems: [
        item({
          id: "admin-allison-d1",
          treatment: "Radiesse",
          interest: "Cheek Volume Loss",
          findings: ["Cheek Volume Loss"],
          region: "Cheeks",
          timeline: "Now",
          quantity: "2",
        }),
        item({
          id: "admin-allison-d2",
          treatment: "Hyaluronic Acid Filler",
          interest: "Marionette Lines",
          findings: ["Marionette Lines"],
          region: "Lower face",
          timeline: "Now",
          quantity: "1",
        }),
        item({
          id: "admin-allison-d3",
          treatment: "Lip Filler",
          interest: "Lip Thinning",
          findings: ["Lip Thinning"],
          region: "Lips",
          timeline: "Add next visit",
          quantity: "1",
        }),
        item({
          id: "admin-allison-d4",
          treatment: "Kybella",
          interest: "Jawline Definition",
          findings: ["Jawline Definition"],
          region: "Chin/Jaw",
          timeline: "Wishlist",
          quantity: "1",
        }),
      ],
    }),
  ];
}

/** True when admin demo clients should be injected. */
export function isAdminDemoClientInjectionEnabled(
  provider?: Pick<Provider, "code" | "name"> | null,
): boolean {
  const v = import.meta.env.VITE_ADMIN_DEMO_CLIENTS as string | undefined;
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  if (isAdminBlueprintProvider((provider ?? null) as Provider | null))
    return true;
  return Boolean(import.meta.env.DEV);
}

function withDemoNameIfCollision(
  client: Client,
  liveNames: Set<string>,
): Client {
  void liveNames;
  return client;
}

/** Returns demo clients if Admin provider + injection enabled; skips duplicate ids, renames on name collision. */
export function getAdminDemoClientsIfEnabled(
  provider: Pick<Provider, "code" | "name"> | null | undefined,
  liveClients: Client[],
): Client[] {
  if (!isAdminBlueprintProvider((provider ?? null) as Provider | null))
    return [];
  if (!isAdminDemoClientInjectionEnabled(provider)) return [];

  const liveIds = new Set(liveClients.map((c) => c.id));
  const liveNames = new Set(
    liveClients.map((c) => c.name.trim().toLowerCase()),
  );

  return getAdminDemoClients()
    .filter((c) => !liveIds.has(c.id))
    .map((c) => withDemoNameIfCollision(c, liveNames));
}
