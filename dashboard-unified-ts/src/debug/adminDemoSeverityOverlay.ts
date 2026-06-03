/**
 * Demo severity rows for showcase patients when Airtable records lack analysis JSON.
 * Keeps Courtney Bellamy redness/pore findings visible in the Aura analysis panel.
 */
import type { AnalysisSeverityIssue, Client } from "../types";

export const COURTNEY_BELLAMY_SEVERITY_ISSUES: Record<string, AnalysisSeverityIssue> =
  {
    "Dark Spots": {
      predicted: true,
      probability: 0.78,
      severity: 2,
      severity_normalized_0_1: 0.44,
      severity_level: "mild-moderate",
    },
    "Red Spots": {
      predicted: true,
      probability: 0.86,
      severity: 3,
      severity_normalized_0_1: 0.68,
      severity_level: "moderate",
    },
    "Rosacea": {
      predicted: true,
      probability: 0.82,
      severity: 2,
      severity_normalized_0_1: 0.62,
      severity_level: "mild-moderate",
    },
    "Whiteheads": {
      predicted: true,
      probability: 0.8,
      severity: 2,
      severity_normalized_0_1: 0.56,
      severity_level: "mild-moderate",
    },
    "Blackheads": {
      predicted: true,
      probability: 0.76,
      severity: 2,
      severity_normalized_0_1: 0.48,
      severity_level: "mild-moderate",
    },
    "Under Eye Dark Circles": {
      predicted: true,
      probability: 0.59,
      severity: 1,
      severity_normalized_0_1: 0.36,
      severity_level: "mild",
    },
    "Forehead Wrinkles": {
      predicted: true,
      probability: 0.62,
      severity: 1,
      severity_normalized_0_1: 0.34,
      severity_level: "mild",
    },
  };

const SEVERITY_BY_DEMO_CLIENT_ID: Record<
  string,
  Record<string, AnalysisSeverityIssue>
> = {
  "admin-demo-courtney": COURTNEY_BELLAMY_SEVERITY_ISSUES,
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
  if (client.id === "admin-demo-courtney") return true;
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
  if (SEVERITY_BY_DEMO_CLIENT_ID[client.id]) {
    return SEVERITY_BY_DEMO_CLIENT_ID[client.id];
  }
  if (isCourtneyBellamyShowcase(client)) {
    return COURTNEY_BELLAMY_SEVERITY_ISSUES;
  }
  return undefined;
}
