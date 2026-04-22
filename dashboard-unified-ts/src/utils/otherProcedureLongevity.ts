/**
 * Patient-facing "Lasts" for **Other procedures** sub-chapters. Category meta uses "Varies";
 * these are typical clinical ranges for consumer UI (not individualized medical advice).
 */
export function resolveOtherProcedureSubChapterLongevity(
  displayName: string,
): string | undefined {
  const n = displayName.trim().toLowerCase();
  if (!n) return undefined;

  if (/cortisone/.test(n)) return "~1–2 weeks per treated spot";
  if (/nerve\s*block/.test(n)) return "Several hours (same day)";
  if (/pronox/.test(n)) return "~Minutes (clears shortly after your visit)";
  if ((/b[-\s]?12|vitamin\s*b/.test(n) || /b12/.test(n)) && /shot|inject/.test(n))
    return "Days–weeks (until next dose if ongoing)";
  if (/skinvive/.test(n)) return "~6 months";
  if (/prfm/.test(n) && /scalp|hair/.test(n)) return "Months (series-based)";
  if (/prfm|platelet[- ]rich fibrin/.test(n)) return "~2–6 months";
  if (/spider\s*vein/.test(n)) return "~8–12 weeks (visible clearing)";
  if (/zapping|milia|sebaceous\s*hyperplasia/.test(n))
    return "Permanent for treated spots";
  if (/light\s*stim/.test(n)) return "Days (glow); builds with visits";
  return undefined;
}

/** Downtime / recovery for **Other procedures** sub-chapters (category meta is broad). */
export function resolveOtherProcedureSubChapterDowntime(
  displayName: string,
): string | undefined {
  const n = displayName.trim().toLowerCase();
  if (!n) return undefined;

  if (/nerve\s*block/.test(n)) return "Minimal (same day)";
  if (/cortisone/.test(n)) return "1–3 days (injection site)";
  if (/pronox/.test(n)) return "None";
  if ((/b[-\s]?12|vitamin\s*b/.test(n) || /b12/.test(n)) && /shot|inject/.test(n))
    return "None";
  if (/skinvive/.test(n)) return "1–2 days";
  if (/prfm|platelet[- ]rich fibrin/.test(n)) return "1–3 days";
  if (/spider\s*vein/.test(n)) return "1–7 days";
  if (/zapping|milia|sebaceous\s*hyperplasia/.test(n)) return "1–3 days";
  if (/light\s*stim/.test(n)) return "None";
  return undefined;
}
