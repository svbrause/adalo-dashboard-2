/**
 * Deep links for Post-Visit Blueprint analysis explorer subpages (category / area / treatment).
 * Hash format: #analysis/category/{key}, #analysis/area/{name}, #analysis/treatment/{treatmentKey}
 * — distinct from treatment chapter anchors (#pvb-ch-...).
 */

export type PvbAnalysisSubpageRoute =
  | { type: "category"; key: string }
  | { type: "area"; name: string }
  | { type: "treatment"; key: string };

export function parsePvbAnalysisSubpageHash(hash: string): PvbAnalysisSubpageRoute | null {
  const raw = hash.replace(/^#/, "").trim();
  const segs = raw.split("/").filter(Boolean);
  if (segs[0] !== "analysis") return null;
  if (segs[1] === "category" && segs[2]) {
    return { type: "category", key: decodeURIComponent(segs[2]) };
  }
  if (segs[1] === "area" && segs[2]) {
    return { type: "area", name: decodeURIComponent(segs[2]) };
  }
  if (segs[1] === "treatment" && segs[2]) {
    return { type: "treatment", key: decodeURIComponent(segs[2]) };
  }
  return null;
}

export function buildPvbCategorySubpageHash(categoryKey: string): string {
  return `#analysis/category/${encodeURIComponent(categoryKey)}`;
}

export function buildPvbAreaSubpageHash(areaName: string): string {
  return `#analysis/area/${encodeURIComponent(areaName)}`;
}

export function buildPvbTreatmentSubpageHash(treatmentKey: string): string {
  return `#analysis/treatment/${encodeURIComponent(treatmentKey)}`;
}
