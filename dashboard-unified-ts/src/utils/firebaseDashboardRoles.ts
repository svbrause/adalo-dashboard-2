/**
 * Dashboard access templates stored as Firebase Auth custom claims.
 * Enforcing these in your app/API (e.g. Firestore rules) is separate from storing them here.
 *
 * Three tiers:
 * - Super admin — internal team; full access (including Users and Roles when allowed).
 * - Admin — administrative privileges scoped to selected practices (`practiceIds`).
 * - Staff — everyone else (day-to-day use within assigned practices).
 *
 * Legacy users with only `practiceIds` (no `role`) are treated as Staff.
 */

export type DashboardRoleTemplate =
  | "super_admin"
  | "practice_admin"
  | "staff";

export const DASHBOARD_ROLE_LABELS: Record<DashboardRoleTemplate, string> = {
  super_admin: "Super admin",
  practice_admin: "Admin",
  staff: "Staff",
};

/** Infer template from existing claims (best-effort). */
export function getDashboardRoleFromClaims(
  claims: Record<string, unknown>,
): DashboardRoleTemplate {
  if (claims.admin === true) return "super_admin";
  if (claims.role === "practice_admin") return "practice_admin";
  return "staff";
}

export function formatRoleSummary(claims: Record<string, unknown>): string {
  const t = getDashboardRoleFromClaims(claims);
  return DASHBOARD_ROLE_LABELS[t];
}

/**
 * Builds new custom claims: preserves non–access-control keys, replaces admin/role/practiceIds.
 */
export function buildClaimsForRoleTemplate(
  existing: Record<string, unknown>,
  practiceIds: string[],
  template: DashboardRoleTemplate,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(existing)) {
    if (k === "admin" || k === "role" || k === "practiceIds") continue;
    next[k] = v;
  }
  next.practiceIds = practiceIds;
  switch (template) {
    case "super_admin":
      next.admin = true;
      break;
    case "practice_admin":
      next.role = "practice_admin";
      break;
    case "staff":
      next.role = "staff";
      break;
  }
  return next;
}
