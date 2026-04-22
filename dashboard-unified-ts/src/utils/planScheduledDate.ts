/** ISO calendar day YYYY-MM-DD for scheduled plan items (no time-of-day). */

export function isValidPlanScheduledDateIso(s: string | undefined): boolean {
  if (!s?.trim()) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

export function parsePlanScheduledDateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d)
    return null;
  return dt;
}

export function formatPlanScheduledDateLabel(
  iso: string | undefined,
): string | null {
  if (!isValidPlanScheduledDateIso(iso)) return null;
  const d = parsePlanScheduledDateLocal(iso!);
  if (!d) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Full calendar date with long month (e.g. July 20, 2026) for patient-facing copy. */
export function formatPlanScheduledDateLongLabel(
  iso: string | undefined,
): string | null {
  if (!isValidPlanScheduledDateIso(iso)) return null;
  const d = parsePlanScheduledDateLocal(iso!);
  if (!d) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Month + day only (matches “short date” style without year). */
export function formatPlanScheduledDateShortNoYear(
  iso: string | undefined,
): string | null {
  if (!isValidPlanScheduledDateIso(iso)) return null;
  const d = parsePlanScheduledDateLocal(iso!);
  if (!d) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(d);
}
