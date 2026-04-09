/**
 * User-facing copy for “Price varies” rows (share link, recommender plan list).
 * Keep in sync with missingInfo strings from treatmentPricing2025 checkout lines.
 */
export function planPricingFixActionLabel(missingInfo: string | undefined): string {
  if (!missingInfo) return "Complete in plan";
  const m = missingInfo.toLowerCase();
  if (m.includes("unit")) return "Add units in plan";
  if (m.includes("select a type") || m.includes("filler type")) return "Choose type in plan";
  if (m.includes("pricing available")) return "Review in plan";
  return "Complete in plan";
}

/** Short badge for plan list rows (left column). */
export function planPricingWarningShort(missingInfo: string | undefined): string | null {
  if (!missingInfo) return null;
  const m = missingInfo.toLowerCase();
  if (m.includes("unit")) return "Needs units";
  if (m.includes("select a type") || m.includes("filler type")) return "Needs type";
  if (m.includes("pricing available")) return "No list price";
  return "Needs details";
}
