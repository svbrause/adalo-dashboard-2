/**
 * Demo severity rows for showcase patients when Airtable records lack analysis JSON.
 * Keeps Courtney Bellamy redness/pore findings visible in the Aura analysis panel.
 */
import type { AnalysisSeverityIssue, Client } from "../types";

export const COURTNEY_BELLAMY_SEVERITY_ISSUES: Record<string, AnalysisSeverityIssue> =
  {
    "Dark Spots": {
      predicted: true,
      probability: 0.52,
      severity: 1,
      severity_normalized_0_1: 0.31,
      severity_level: "mild",
    },
    "Red Spots": {
      predicted: true,
      probability: 0.9,
      severity: 3,
      severity_normalized_0_1: 0.74,
      severity_level: "moderate-severe",
    },
    "Rosacea": {
      predicted: true,
      probability: 0.87,
      severity: 3,
      severity_normalized_0_1: 0.69,
      severity_level: "moderate",
    },
    "Whiteheads": {
      predicted: true,
      probability: 0.74,
      severity: 2,
      severity_normalized_0_1: 0.46,
      severity_level: "mild-moderate",
    },
    "Blackheads": {
      predicted: true,
      probability: 0.82,
      severity: 2,
      severity_normalized_0_1: 0.55,
      severity_level: "mild-moderate",
    },
    "Dry Skin": {
      predicted: true,
      probability: 0.58,
      severity: 1,
      severity_normalized_0_1: 0.37,
      severity_level: "mild",
    },
    "Under Eye Dark Circles": {
      predicted: true,
      probability: 0.44,
      severity: 1,
      severity_normalized_0_1: 0.28,
      severity_level: "mild",
    },
    "Forehead Wrinkles": {
      predicted: false,
      probability: 0.24,
      severity: 0,
      severity_normalized_0_1: 0.18,
      severity_level: "none",
    },
  };

function clientAuraHaystack(client: {
  auraManifestUrl?: string | null;
  auraGcsPrefix?: string | null;
  frontPhoto?: string | null;
  galleryPhotoSlots?: Client["galleryPhotoSlots"];
}): string {
  const slotUrls = (client.galleryPhotoSlots ?? [])
    .map((s) => s.url)
    .filter(Boolean)
    .join(" ");
  return [client.auraManifestUrl, client.auraGcsPrefix, client.frontPhoto, slotUrls]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isCourtneyBellamyShowcase(
  client: Pick<Client, "id" | "name"> & {
    auraManifestUrl?: string | null;
    auraGcsPrefix?: string | null;
    frontPhoto?: string | null;
    galleryPhotoSlots?: Client["galleryPhotoSlots"];
  },
): boolean {
  const haystack = clientAuraHaystack(client);
  if (haystack.includes("courtney-bellamy")) return true;
  const name = client.name
    .replace(/\s*\(aura demo\)\s*$/i, "")
    .trim()
    .toLowerCase();
  return name === "courtney bellamy" && haystack.includes("courtney");
}

/** Severity issue map for analysis UI (client JSON or Courtney showcase fallback). */
export function adminDemoSeverityIssuesForClient(
  client: Pick<
    Client,
    | "id"
    | "name"
    | "severityScoresFromAnalyses"
    | "auraManifestUrl"
    | "auraGcsPrefix"
    | "frontPhoto"
    | "galleryPhotoSlots"
  >,
): Record<string, AnalysisSeverityIssue> | undefined {
  const fromClient = client.severityScoresFromAnalyses?.issues;
  if (fromClient && Object.keys(fromClient).length > 0) {
    return fromClient;
  }
  if (isCourtneyBellamyShowcase(client)) {
    return COURTNEY_BELLAMY_SEVERITY_ISSUES;
  }
  return undefined;
}
