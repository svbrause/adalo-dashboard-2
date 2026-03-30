import type { TreatmentPhoto } from "../types";

/** Area names for display: remove trailing " All" and omit standalone "All". */
export function getTreatmentPhotoAreaDisplayList(areaNames: string[]): string[] {
  return areaNames
    .map((a) => String(a).replace(/\s*All$/i, "").trim())
    .filter((a) => a && a.toLowerCase() !== "all");
}

function buildTitleFromLinkedFields(photo: TreatmentPhoto): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  const add = (s: string) => {
    const t = String(s).trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    parts.push(t);
  };
  for (const t of photo.treatments) add(t);
  for (const t of photo.generalTreatments) add(t);
  const areas = getTreatmentPhotoAreaDisplayList(photo.areaNames).join(", ");
  const core = parts.join(" · ");
  if (core && areas) return `${core} – ${areas}`;
  if (core) return core;
  if (areas) return areas;
  return "";
}

/**
 * Card / list title for a Photos row. Prefers linked treatment + general-treatment labels
 * (and area) when the primary `Name` looks like a long formula concat (e.g. product + category + goal run together).
 * Short curated names still win when links exist.
 */
export function getTreatmentPhotoDisplayTitle(photo: TreatmentPhoto): string {
  const fromLinks = buildTitleFromLinkedFields(photo);
  const name = photo.name?.trim() ?? "";
  const wordCount = name ? name.split(/\s+/).filter(Boolean).length : 0;
  const nameLooksLikeDump = name.length > 44 || wordCount >= 6;

  if (fromLinks) {
    if (!name || nameLooksLikeDump) return fromLinks;
    return name;
  }
  if (name) return name;
  return "Treatment example";
}

/** Lowercase blob for filter / “exact match” scoring (name, linked treatments, areas). */
export function getTreatmentPhotoSearchHaystack(photo: TreatmentPhoto): string {
  return [
    photo.name ?? "",
    ...photo.treatments.map((t) => String(t)),
    ...photo.generalTreatments.map((t) => String(t)),
    ...getTreatmentPhotoAreaDisplayList(photo.areaNames),
  ]
    .join(" ")
    .toLowerCase();
}
