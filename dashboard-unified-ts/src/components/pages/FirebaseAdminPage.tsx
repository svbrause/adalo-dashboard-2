import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useFirebaseAuth } from "../../context/FirebaseAuthContext";
import {
  createFirebaseUser,
  fetchFirebaseAdminStatus,
  inviteFirebaseUser,
  listFirebaseUsers,
  patchFirebaseUser,
  requestEmailVerificationLink,
  requestPasswordResetLink,
  resendFirebaseUserInvite,
  revokeUserSessions,
  sendFirebaseUserPasswordResetEmail,
  setFirebaseUserCustomClaims,
  type FirebaseAdminUserRow,
} from "../../services/firebaseAdminApi";
import { showError, showToast } from "../../utils/toast";
import {
  fetchAllPracticesForAdmin,
  type PracticeOption,
} from "../../services/providersDirectory";
import {
  buildClaimsForRoleTemplate,
  DASHBOARD_ROLE_LABELS,
  formatRoleSummary,
  getDashboardRoleFromClaims,
  type DashboardRoleTemplate,
} from "../../utils/firebaseDashboardRoles";
import { FilterSelect } from "../layout/FilterSelect";
import type { FilterSelectOption } from "../layout/FilterSelect";
import "../layout/ViewControls.css";
import FirebaseAdminGuide from "./FirebaseAdminGuide";
import "./FirebaseAdminPage.css";

export type FirebaseAdminPageProps = {
  /** When true, layout matches in-dashboard views (sidebar + header); omit for standalone `/admin/firebase`. */
  embedded?: boolean;
  /** Used with `embedded`: return to main dashboard (e.g. client list). */
  onLeaveEmbedded?: () => void;
};

function rootClass(embedded: boolean, extra?: string): string {
  return [
    "firebase-admin-page",
    embedded ? "firebase-admin-page--embedded" : "",
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

function getPracticeIdsFromClaims(
  claims: Record<string, unknown>,
): string[] {
  const raw = claims.practiceIds;
  if (Array.isArray(raw) && raw.every((x) => typeof x === "string")) {
    return raw as string[];
  }
  return [];
}

/** Resolve provider record ids in claims to display names using the practice directory. */
function formatPracticeNamesForRow(
  claims: Record<string, unknown>,
  practiceList: PracticeOption[],
): string {
  const ids = getPracticeIdsFromClaims(claims);
  if (ids.length === 0) return "—";
  const byId = new Map(practiceList.map((p) => [p.id, p]));
  return ids
    .map((id) => {
      const p = byId.get(id);
      const name = p?.name?.trim();
      if (name) return name;
      return `Unknown location…${id.slice(-6)}`;
    })
    .join(", ");
}

/** Comma-separated display names for selected practice ids (invite email context). */
function formatPracticeIdsAsCommaNames(
  ids: string[],
  practiceList: PracticeOption[],
): string {
  if (ids.length === 0) return "";
  const byId = new Map(practiceList.map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id)?.name?.trim())
    .filter((s): s is string => Boolean(s && s.length > 0))
    .join(", ");
}

function formatAuthTime(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** No successful sign-in yet and account can sign in — includes invited users who haven’t finished setup. */
function isPendingFirstSignIn(u: FirebaseAdminUserRow): boolean {
  if (u.disabled) return false;
  const t = u.lastSignInTime;
  return t == null || String(t).trim() === "";
}

function onboardingSummary(u: FirebaseAdminUserRow): string {
  if (u.disabled) {
    return u.lastSignInTime ? "Disabled" : "Disabled, never signed in";
  }
  return isPendingFirstSignIn(u) ? "Not signed in yet" : "Has signed in";
}

type SortKey = "email-asc" | "email-desc" | "signin-newest" | "signin-oldest";

type FirebaseAccountStatusFilter = "all" | "yes" | "no";

/** Shared list pipeline for directory table (accountStatus overrides filterDisabled for split views). */
function filterAndSortFirebaseAdminUsers(
  userList: FirebaseAdminUserRow[],
  params: {
    listSearch: string;
    filterVerified: "all" | "yes" | "no";
    accountStatus: FirebaseAccountStatusFilter;
    filterRole: "all" | DashboardRoleTemplate;
    filterFirstSignIn: "all" | "pending" | "signed_in";
    practices: PracticeOption[];
    viewerIsSuperAdmin: boolean | null;
    sortKey: SortKey;
  },
): FirebaseAdminUserRow[] {
  const q = params.listSearch.trim().toLowerCase();
  const filtered = userList.filter((u) => {
    if (params.filterVerified === "yes" && !u.emailVerified) return false;
    if (params.filterVerified === "no" && u.emailVerified) return false;
    if (params.accountStatus === "yes" && !u.disabled) return false;
    if (params.accountStatus === "no" && u.disabled) return false;
    const role = getDashboardRoleFromClaims(u.customClaims);
    if (params.filterRole !== "all" && role !== params.filterRole) return false;
    if (params.filterFirstSignIn === "pending" && !isPendingFirstSignIn(u)) {
      return false;
    }
    if (params.filterFirstSignIn === "signed_in") {
      if (!u.lastSignInTime || String(u.lastSignInTime).trim() === "") {
        return false;
      }
    }
    if (!q) return true;
    const parts = [
      u.email ?? "",
      u.displayName ?? "",
      formatRoleSummary(u.customClaims),
      formatPracticeNamesForRow(u.customClaims, params.practices),
      onboardingSummary(u),
    ];
    if (params.viewerIsSuperAdmin === true) parts.push(u.uid);
    const haystack = parts.join(" ").toLowerCase();
    return haystack.includes(q);
  });

  filtered.sort((a, b) => {
    if (params.sortKey === "email-asc" || params.sortKey === "email-desc") {
      const ea = (a.email ?? "").toLowerCase();
      const eb = (b.email ?? "").toLowerCase();
      return params.sortKey === "email-asc"
        ? ea.localeCompare(eb)
        : eb.localeCompare(ea);
    }
    const ta = a.lastSignInTime ? new Date(a.lastSignInTime).getTime() : 0;
    const tb = b.lastSignInTime ? new Date(b.lastSignInTime).getTime() : 0;
    return params.sortKey === "signin-newest" ? tb - ta : ta - tb;
  });

  return filtered;
}

const SORT_LABELS: Record<SortKey, string> = {
  "email-asc": "Sort by email A→Z",
  "email-desc": "Sort by email Z→A",
  "signin-newest": "Sort by sign-in newest",
  "signin-oldest": "Sort by sign-in oldest",
};
const SORT_OPTIONS: { value: SortKey; label: string; description: string }[] = [
  {
    value: "email-asc",
    label: SORT_LABELS["email-asc"],
    description: "Alphabetical by email address.",
  },
  {
    value: "email-desc",
    label: SORT_LABELS["email-desc"],
    description: "Reverse alphabetical by email address.",
  },
  {
    value: "signin-newest",
    label: SORT_LABELS["signin-newest"],
    description: "Recently active users first.",
  },
  {
    value: "signin-oldest",
    label: SORT_LABELS["signin-oldest"],
    description: "Never signed in and least recent first.",
  },
];

const ROLE_SELECT_OPTIONS: { value: DashboardRoleTemplate; label: string }[] =
  [
    { value: "super_admin", label: DASHBOARD_ROLE_LABELS.super_admin },
    { value: "practice_admin", label: DASHBOARD_ROLE_LABELS.practice_admin },
    { value: "staff", label: DASHBOARD_ROLE_LABELS.staff },
  ];

/** Practice-level admins cannot assign super admin; keeps Firebase org control centralized. */
const ROLE_OPTIONS_PRACTICE_VIEW: {
  value: DashboardRoleTemplate;
  label: string;
}[] = ROLE_SELECT_OPTIONS.filter((o) => o.value !== "super_admin");

/** Create-user modal: role choices (unchanged from legacy native select). */
const ADD_USER_ROLE_OPTIONS: FilterSelectOption[] = ROLE_SELECT_OPTIONS.map(
  (o) => ({ value: o.value, label: o.label }),
);

const FILTER_ACCOUNT_STATUS_OPTIONS: FilterSelectOption[] = [
  { value: "all", label: "All accounts" },
  { value: "no", label: "Active accounts only" },
  { value: "yes", label: "Disabled accounts only" },
];

const FILTER_FIRST_SIGN_IN_OPTIONS: FilterSelectOption[] = [
  { value: "all", label: "All sign-in states" },
  { value: "pending", label: "Not signed in yet" },
  { value: "signed_in", label: "Has signed in" },
];

const FILTER_VERIFIED_OPTIONS: FilterSelectOption[] = [
  { value: "all", label: "Any verification state" },
  { value: "yes", label: "Verified" },
  { value: "no", label: "Not verified" },
];

const SORT_FILTER_SELECT_OPTIONS: FilterSelectOption[] = SORT_OPTIONS.map(
  (o) => ({
    value: o.value,
    /** One line: trigger uses nowrap ellipsis; menu shows the same full text. */
    label: `${o.label} — ${o.description}`,
  }),
);

type FirebaseAdminDirectoryRowProps = {
  u: FirebaseAdminUserRow;
  viewerIsSuperAdmin: boolean | null;
  actionBusyUid: string | null;
  canManage: boolean;
  onManage: (u: FirebaseAdminUserRow) => void;
  onView: (uid: string) => void;
};

function FirebaseAdminDirectoryRow({
  u,
  viewerIsSuperAdmin,
  actionBusyUid,
  canManage,
  onManage,
  onView,
}: FirebaseAdminDirectoryRowProps) {
  return (
    <tr>
      <td>{u.email ?? "—"}</td>
      <td
        className="firebase-admin-page__display-name-cell"
        title={u.displayName?.trim() || undefined}
      >
        {u.displayName?.trim() ? u.displayName.trim() : "—"}
      </td>
      <td className="firebase-admin-page__cell-nowrap firebase-admin-page__signin-cell">
        {u.lastSignInTime ? (
          formatAuthTime(u.lastSignInTime)
        ) : isPendingFirstSignIn(u) ? (
          <span
            className="firebase-admin-page__pill firebase-admin-page__pill--pending"
            title="No successful sign-in yet — often an open invite"
          >
            Invite pending
          </span>
        ) : (
          <span className="firebase-admin-page__muted">Never</span>
        )}
      </td>
      {viewerIsSuperAdmin === true && (
        <>
          <td className="firebase-admin-page__mono">{u.uid}</td>
          <td>{u.disabled ? "Yes" : "No"}</td>
        </>
      )}
      <td>{formatRoleSummary(u.customClaims)}</td>
      <td className="firebase-admin-page__actions-cell">
        <button
          type="button"
          className="btn-secondary btn-sm firebase-admin-page__open-detail-btn"
          disabled={actionBusyUid === u.uid}
          onClick={() => {
            if (canManage) onManage(u);
            else onView(u.uid);
          }}
        >
          {actionBusyUid === u.uid ? "…" : canManage ? "Manage" : "View"}
        </button>
      </td>
    </tr>
  );
}

type SuperAdminPracticePickerProps = {
  practices: PracticeOption[];
  selectedIds: string[];
  onToggle: (practiceId: string) => void;
  disabled?: boolean;
  idPrefix: string;
};

/** Checkboxes for super admins who have no practiceIds on their own token — avoids granting every directory practice by default. */
function SuperAdminPracticePicker({
  practices,
  selectedIds,
  onToggle,
  disabled,
  idPrefix,
}: SuperAdminPracticePickerProps) {
  if (practices.length === 0) {
    return (
      <p className="firebase-admin-page__muted firebase-admin-page__practice-picker-empty">
        No practices loaded. Check the practice directory API or server configuration.
      </p>
    );
  }
  return (
    <div
      className="firebase-admin-page__practice-picker"
      role="group"
      aria-label="Practice locations this user can access"
    >
      {practices.map((p) => {
        const inputId = `${idPrefix}-practice-${p.id}`;
        const checked = selectedIds.includes(p.id);
        return (
          <label
            key={p.id}
            className="firebase-admin-page__practice-picker-row"
            htmlFor={inputId}
          >
            <input
              id={inputId}
              type="checkbox"
              className="firebase-admin-page__practice-picker-check"
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(p.id)}
            />
            <span className="firebase-admin-page__practice-picker-name">
              {p.name?.trim() || p.code}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export default function FirebaseAdminPage({
  embedded = false,
  onLeaveEmbedded,
}: FirebaseAdminPageProps) {
  const {
    isConfigured,
    user,
    loading: authLoading,
    signInWithEmailPassword,
    signOutFirebase,
  } = useFirebaseAuth();

  /** `admin: true` on the signed-in user — full technical controls. */
  const [viewerIsSuperAdmin, setViewerIsSuperAdmin] = useState<boolean | null>(
    null,
  );
  /** Practice Admin vs Staff (ignored when `admin: true`). */
  const [viewerPracticeRole, setViewerPracticeRole] = useState<
    "practice_admin" | "staff" | null
  >(null);
  /** `practiceIds` from the signed-in user’s token (provider directory record ids). */
  const [viewerPracticeIds, setViewerPracticeIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      setViewerIsSuperAdmin(null);
      setViewerPracticeRole(null);
      setViewerPracticeIds([]);
      return;
    }
    let cancelled = false;
    user
      .getIdTokenResult()
      .then((r) => {
        if (cancelled) return;
        const c = r.claims as Record<string, unknown>;
        const isSa = c.admin === true || c.admin === "true";
        setViewerIsSuperAdmin(isSa);
        const rawP = c.practiceIds;
        let pids: string[] = [];
        if (Array.isArray(rawP) && rawP.every((x) => typeof x === "string")) {
          pids = rawP as string[];
        }
        setViewerPracticeIds(pids);
        if (isSa) {
          setViewerPracticeRole(null);
          return;
        }
        if (c.role === "practice_admin") {
          setViewerPracticeRole("practice_admin");
        } else {
          setViewerPracticeRole("staff");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setViewerIsSuperAdmin(false);
          setViewerPracticeRole("staff");
          setViewerPracticeIds([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  /** Non–super-admin with at least one practice on their profile — hide org-wide practice pickers. */
  const viewerIsPracticeScoped =
    viewerIsSuperAdmin !== true && viewerPracticeIds.length > 0;

  /** Super admin with no `practiceIds` on token — pick locations explicitly (never default to whole directory). */
  const showSuperAdminPracticePicker =
    viewerIsSuperAdmin === true && viewerPracticeIds.length === 0;

  const toggleSuperAdminPracticeId = useCallback((practiceId: string) => {
    setSuperAdminPracticeSelectionIds((prev) =>
      prev.includes(practiceId)
        ? prev.filter((id) => id !== practiceId)
        : [...prev, practiceId],
    );
  }, []);

  /** Invite, edit permissions, password reset — super admin, practice admin, and staff. */
  const viewerCanUseDirectory =
    viewerIsSuperAdmin === true ||
    viewerPracticeRole === "practice_admin" ||
    viewerPracticeRole === "staff";

  /** Disable/enable accounts — super admin and practice admin only (not staff). */
  const viewerCanDisableUsers =
    viewerIsSuperAdmin === true || viewerPracticeRole === "practice_admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [practices, setPractices] = useState<PracticeOption[]>([]);
  const [practicesError, setPracticesError] = useState<string | null>(null);

  const [users, setUsers] = useState<FirebaseAdminUserRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [pageToken, setPageToken] = useState<string | null>(null);

  /**
   * Super admin with no `practiceIds` on their token: explicit locations for invite / create / save.
   * (Never default to “all practices in the directory”.)
   */
  const [superAdminPracticeSelectionIds, setSuperAdminPracticeSelectionIds] =
    useState<string[]>([]);

  const [editingUid, setEditingUid] = useState<string | null>(null);
  /** True when Manage modal was opened from overview (enables "Back to overview"). */
  const [manageOpenedFromDetail, setManageOpenedFromDetail] = useState(false);
  const [detailUserUid, setDetailUserUid] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  /** When false and user has an email, show read-only email until "Change email" is used. */
  const [manageEmailUnlocked, setManageEmailUnlocked] = useState(false);
  /** Password reset, invite resend, verification — collapsed by default unless attention. */
  const [manageSignInExtrasOpen, setManageSignInExtrasOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRoleTemplate, setEditRoleTemplate] =
    useState<DashboardRoleTemplate>("staff");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showAddUser, setShowAddUser] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addDisplayName, setAddDisplayName] = useState("");
  const [addRoleTemplate, setAddRoleTemplate] =
    useState<DashboardRoleTemplate>("staff");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [showInviteUser, setShowInviteUser] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteRoleTemplate, setInviteRoleTemplate] =
    useState<DashboardRoleTemplate>("staff");
  const [invitePersonalMessage, setInvitePersonalMessage] = useState("");
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [listSearch, setListSearch] = useState("");
  const [filterVerified, setFilterVerified] = useState<"all" | "yes" | "no">(
    "all",
  );
  /** "all" = show active + disabled in split sections; "no"/"yes" = single list (counts as an active filter). */
  const [filterDisabled, setFilterDisabled] = useState<"all" | "yes" | "no">(
    "all",
  );
  const [filterRole, setFilterRole] = useState<"all" | DashboardRoleTemplate>(
    "all",
  );
  const [filterFirstSignIn, setFilterFirstSignIn] = useState<
    "all" | "pending" | "signed_in"
  >("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("email-asc");
  const toolbarControlsRef = useRef<HTMLDivElement | null>(null);

  const [linkModal, setLinkModal] = useState<{
    title: string;
    link: string;
    email: string;
    hint?: string;
  } | null>(null);
  const [actionBusyUid, setActionBusyUid] = useState<string | null>(null);

  const editingUserRow = useMemo(() => {
    if (!editingUid) return null;
    return users.find((x) => x.uid === editingUid) ?? null;
  }, [editingUid, users]);

  const detailUserRow = useMemo(() => {
    if (!detailUserUid) return null;
    return users.find((x) => x.uid === detailUserUid) ?? null;
  }, [detailUserUid, users]);

  /**
   * Sign-in section: open when invite is pending or email is unverified.
   * Short summary on the closed row explains why the section is highlighted (details stay next to actions).
   */
  const manageSignInExtrasAttention = useMemo(() => {
    const u = editingUserRow;
    if (!u?.email) {
      return { needsAttention: false, summary: "" as string };
    }
    const invitePending =
      viewerCanUseDirectory && !u.disabled && isPendingFirstSignIn(u);
    const emailUnverified = !u.emailVerified;
    const needsAttention = invitePending || emailUnverified;
    let summary = "";
    if (needsAttention) {
      if (invitePending && emailUnverified) {
        summary =
          "First sign-in and email verification are still outstanding";
      } else if (invitePending) {
        summary = "First sign-in is not finished yet";
      } else {
        summary = "Email address is not verified yet";
      }
    }
    return { needsAttention, summary };
  }, [editingUserRow, viewerCanUseDirectory]);

  const canManageUserRow = useCallback(
    (u: FirebaseAdminUserRow) => {
      if (!viewerCanUseDirectory) return false;
      if (viewerIsSuperAdmin === true) return true;
      return getDashboardRoleFromClaims(u.customClaims) !== "super_admin";
    },
    [viewerCanUseDirectory, viewerIsSuperAdmin],
  );

  const clearFirebaseAdminFilters = useCallback(() => {
    setListSearch("");
    setFilterVerified("all");
    setFilterDisabled("all");
    setFilterRole("all");
    setFilterFirstSignIn("all");
  }, []);

  useEffect(() => {
    if (!editingUid) setManageOpenedFromDetail(false);
  }, [editingUid]);

  useEffect(() => {
    fetchFirebaseAdminStatus()
      .then((s) => setBackendReady(s.firebaseAdminReady))
      .catch(() => setBackendReady(false));
  }, []);

  const loadPractices = useCallback(async () => {
    setPracticesError(null);
    try {
      const list = await fetchAllPracticesForAdmin();
      list.sort((a, b) =>
        (a.name || a.code).localeCompare(b.name || b.code, undefined, {
          sensitivity: "base",
        }),
      );
      setPractices(list);
    } catch (e) {
      setPracticesError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const loadUsers = useCallback(
    async (token: string | null, append: boolean) => {
      if (!user) return;
      setListLoading(true);
      setListError(null);
      try {
        const idToken = await user.getIdToken();
        const res = await listFirebaseUsers(idToken, {
          maxResults: 50,
          pageToken: token ?? undefined,
        });
        setUsers((prev) =>
          append ? [...prev, ...res.users] : res.users,
        );
        setPageToken(res.pageToken);
      } catch (e) {
        setListError(e instanceof Error ? e.message : String(e));
      } finally {
        setListLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user || !backendReady) return;
    void loadPractices();
    void loadUsers(null, false);
  }, [user, backendReady, loadPractices, loadUsers]);

  useEffect(() => {
    if (!showFilters && !showSort) return;

    const closeOpenToolbarPanel = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (toolbarControlsRef.current?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest(".filter-select-custom-menu")
      ) {
        return;
      }
      setShowFilters(false);
      setShowSort(false);
    };

    document.addEventListener("mousedown", closeOpenToolbarPanel);
    document.addEventListener("touchstart", closeOpenToolbarPanel);

    return () => {
      document.removeEventListener("mousedown", closeOpenToolbarPanel);
      document.removeEventListener("touchstart", closeOpenToolbarPanel);
    };
  }, [showFilters, showSort]);

  /** Practices on the row being edited that sit outside the viewer’s scope (preserved on save). */
  const editingExternalPracticeIds = useMemo(() => {
    if (!editingUid || !viewerIsPracticeScoped) return [];
    const row = users.find((u) => u.uid === editingUid);
    if (!row) return [];
    return getPracticeIdsFromClaims(row.customClaims).filter(
      (id) => !viewerPracticeIds.includes(id),
    );
  }, [editingUid, users, viewerIsPracticeScoped, viewerPracticeIds]);

  /**
   * Practice IDs applied when creating or updating users: the signed-in admin’s token
   * `practiceIds` when set; otherwise (super admin without token practices) the explicit
   * checkbox selection — never the whole directory by default.
   */
  const resolvedStaffPracticeIds = useMemo((): string[] => {
    if (viewerPracticeIds.length > 0) {
      return [...viewerPracticeIds];
    }
    if (showSuperAdminPracticePicker) {
      return [...superAdminPracticeSelectionIds];
    }
    return [];
  }, [
    viewerPracticeIds,
    showSuperAdminPracticePicker,
    superAdminPracticeSelectionIds,
  ]);

  useEffect(() => {
    if (!editingUid) {
      setManageSignInExtrasOpen(false);
      return;
    }
    setManageSignInExtrasOpen(manageSignInExtrasAttention.needsAttention);
  }, [editingUid, manageSignInExtrasAttention.needsAttention]);

  const roleFilterSelectOptions = useMemo((): FilterSelectOption[] => {
    const roleOpts =
      viewerIsSuperAdmin === true
        ? ROLE_SELECT_OPTIONS
        : ROLE_OPTIONS_PRACTICE_VIEW;
    return [
      { value: "all", label: "All roles" },
      ...roleOpts.map((o) => ({ value: o.value, label: o.label })),
    ];
  }, [viewerIsSuperAdmin]);

  /** Manage user + invite: assignable roles for the current viewer (no “all roles”). */
  const assignableRoleSelectOptions = useMemo(
    () => roleFilterSelectOptions.filter((o) => o.value !== "all"),
    [roleFilterSelectOptions],
  );

  const filterPipelineParams = useMemo(
    () => ({
      listSearch,
      filterVerified,
      filterRole,
      filterFirstSignIn,
      practices,
      viewerIsSuperAdmin,
      sortKey,
    }),
    [
      listSearch,
      filterVerified,
      filterRole,
      filterFirstSignIn,
      practices,
      viewerIsSuperAdmin,
      sortKey,
    ],
  );

  const filteredUsers = useMemo(
    () =>
      filterAndSortFirebaseAdminUsers(users, {
        ...filterPipelineParams,
        accountStatus: filterDisabled,
      }),
    [users, filterPipelineParams, filterDisabled],
  );

  const splitActiveUsers = useMemo(
    () =>
      filterDisabled === "all"
        ? filterAndSortFirebaseAdminUsers(users, {
            ...filterPipelineParams,
            accountStatus: "no",
          })
        : [],
    [users, filterPipelineParams, filterDisabled],
  );

  const splitDisabledUsers = useMemo(
    () =>
      filterDisabled === "all"
        ? filterAndSortFirebaseAdminUsers(users, {
            ...filterPipelineParams,
            accountStatus: "yes",
          })
        : [],
    [users, filterPipelineParams, filterDisabled],
  );

  const firebaseAdminFilterTags = useMemo(() => {
    const tags: string[] = [];
    const q = listSearch.trim();
    if (q) tags.push(`Search: "${q}"`);
    if (filterVerified !== "all") {
      tags.push(
        filterVerified === "yes"
          ? "Email verified: Yes"
          : "Email verified: No",
      );
    }
    if (filterDisabled !== "all") {
      tags.push(
        filterDisabled === "no"
          ? "Accounts: Active only"
          : "Accounts: Disabled only",
      );
    }
    if (filterRole !== "all") {
      tags.push(`Role: ${DASHBOARD_ROLE_LABELS[filterRole]}`);
    }
    if (filterFirstSignIn !== "all") {
      tags.push(
        filterFirstSignIn === "pending"
          ? "First sign-in: Not yet"
          : "First sign-in: Has signed in",
      );
    }
    return tags;
  }, [
    listSearch,
    filterVerified,
    filterDisabled,
    filterRole,
    filterFirstSignIn,
  ]);

  const firebaseAdminUserCountMeta = useMemo(() => {
    const loaded = users.length;
    const loadedSuffix = loaded ? ` · ${loaded} loaded` : "";
    if (filterDisabled === "all") {
      const na = splitActiveUsers.length;
      const nd = splitDisabledUsers.length;
      if (nd === 0) {
        return `${na} active account${na !== 1 ? "s" : ""}${loadedSuffix}`;
      }
      return `${na} active · ${nd} disabled${loadedSuffix}`;
    }
    if (filterDisabled === "no") {
      const n = filteredUsers.length;
      return `${n} active account${n !== 1 ? "s" : ""}${loadedSuffix}`;
    }
    const n = filteredUsers.length;
    return `${n} disabled account${n !== 1 ? "s" : ""}${loadedSuffix}`;
  }, [
    users.length,
    filterDisabled,
    splitActiveUsers.length,
    splitDisabledUsers.length,
    filteredUsers.length,
  ]);

  const directoryTableColSpan = viewerIsSuperAdmin === true ? 7 : 5;

  const directoryTableShowsEmpty = useMemo(
    () =>
      users.length > 0 &&
      (filterDisabled === "all"
        ? splitActiveUsers.length === 0 && splitDisabledUsers.length === 0
        : filteredUsers.length === 0),
    [
      users.length,
      filterDisabled,
      splitActiveUsers.length,
      splitDisabledUsers.length,
      filteredUsers.length,
    ],
  );

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    setSigningIn(true);
    try {
      await signInWithEmailPassword(email, password);
      setPassword("");
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setSigningIn(false);
    }
  };

  const runRowAction = async (
    uid: string,
    fn: () => Promise<void>,
  ): Promise<void> => {
    setActionBusyUid(uid);
    try {
      await fn();
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusyUid(null);
    }
  };

  const openPasswordResetLink = async (u: FirebaseAdminUserRow) => {
    if (!user || !u.email) {
      showError("This user has no email address.");
      return;
    }
    await runRowAction(u.uid, async () => {
      const idToken = await user.getIdToken();
      const r = await requestPasswordResetLink(idToken, u.uid);
      setLinkModal({
        title: "Password reset link",
        link: r.link,
        email: r.email,
        hint: r.hint,
      });
    });
  };

  const openEmailVerifyLink = async (u: FirebaseAdminUserRow) => {
    if (!user || !u.email) {
      showError("This user has no email address.");
      return;
    }
    await runRowAction(u.uid, async () => {
      const idToken = await user.getIdToken();
      const r = await requestEmailVerificationLink(idToken, u.uid);
      setLinkModal({
        title: "Email verification link",
        link: r.link,
        email: r.email,
        hint: r.hint,
      });
    });
  };

  const handleResendInviteEmail = async (u: FirebaseAdminUserRow) => {
    if (!user || !u.email) {
      showError("This user has no email address.");
      return;
    }
    await runRowAction(u.uid, async () => {
      const idToken = await user.getIdToken();
      const practiceNamesForEmail =
        formatPracticeIdsAsCommaNames(
          getPracticeIdsFromClaims(u.customClaims),
          practices,
        ) || undefined;
      const r = await resendFirebaseUserInvite(idToken, u.uid, {
        practiceNamesForEmail,
      });
      showToast(r.message ?? "Invitation email sent.");
    });
  };

  const handleSendPasswordResetEmail = async (u: FirebaseAdminUserRow) => {
    if (!user || !u.email) {
      showError("This user has no email address.");
      return;
    }
    await runRowAction(u.uid, async () => {
      const idToken = await user.getIdToken();
      const practiceNamesForEmail =
        formatPracticeIdsAsCommaNames(
          getPracticeIdsFromClaims(u.customClaims),
          practices,
        ) || undefined;
      const r = await sendFirebaseUserPasswordResetEmail(idToken, u.uid, {
        practiceNamesForEmail,
      });
      showToast(r.message ?? "Password reset email sent.");
    });
  };

  const handleRevokeSessions = async (u: FirebaseAdminUserRow) => {
    if (!user) return;
    if (
      !window.confirm(
        `Revoke all sessions for ${u.email ?? u.uid}? They must sign in again on every device.`,
      )
    ) {
      return;
    }
    await runRowAction(u.uid, async () => {
      const idToken = await user.getIdToken();
      await revokeUserSessions(idToken, u.uid);
      showToast("Sessions revoked for this user.");
    });
  };

  const handleToggleDisabled = async (u: FirebaseAdminUserRow) => {
    if (!user) return;
    const next = !u.disabled;
    const msg = next
      ? `Disable account ${u.email ?? u.uid}? They cannot sign in until re-enabled.`
      : `Re-enable account ${u.email ?? u.uid}?`;
    if (!window.confirm(msg)) return;
    await runRowAction(u.uid, async () => {
      const idToken = await user.getIdToken();
      await patchFirebaseUser(idToken, u.uid, { disabled: next });
      setUsers((prev) =>
        prev.map((r) =>
          r.uid === u.uid ? { ...r, disabled: next } : r,
        ),
      );
      showToast(next ? "Account disabled." : "Account enabled.");
      setDetailUserUid((openUid) => (openUid === u.uid ? null : openUid));
    });
  };

  const openEdit = (u: FirebaseAdminUserRow, opts?: { fromDetail?: boolean }) => {
    setManageOpenedFromDetail(opts?.fromDetail === true);
    setManageEmailUnlocked(false);
    setEditingUid(u.uid);
    setEditEmail(u.email ?? "");
    setEditDisplayName(u.displayName ?? "");
    setEditRoleTemplate(
      getDashboardRoleFromClaims(u.customClaims),
    );
    if (viewerIsSuperAdmin === true && viewerPracticeIds.length === 0) {
      setSuperAdminPracticeSelectionIds(
        getPracticeIdsFromClaims(u.customClaims).filter((id) =>
          practices.some((p) => p.id === id),
        ),
      );
    }
    setSaveError(null);
  };

  const closeAddUserModal = useCallback(() => {
    setShowAddUser(false);
    setAddError(null);
  }, []);

  const closeInviteUserModal = useCallback(() => {
    setShowInviteUser(false);
    setInviteError(null);
  }, []);

  useEffect(() => {
    if (!showAddUser && !showInviteUser) return;
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showAddUser && !addSaving) closeAddUserModal();
      if (showInviteUser && !inviteSaving) closeInviteUserModal();
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [
    showAddUser,
    showInviteUser,
    addSaving,
    inviteSaving,
    closeAddUserModal,
    closeInviteUserModal,
  ]);

  const handleInviteUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setInviteError(null);
    if (!inviteEmail.trim()) {
      setInviteError("Email is required.");
      return;
    }
    setInviteSaving(true);
    try {
      if (resolvedStaffPracticeIds.length === 0) {
        setInviteError(
          showSuperAdminPracticePicker && practices.length > 0
            ? "Select at least one practice location."
            : "No practice locations are available. Check the practice directory or your admin account.",
        );
        setInviteSaving(false);
        return;
      }
      const idToken = await user.getIdToken();
      const invitePracticePayload = resolvedStaffPracticeIds;
      const initialClaims = buildClaimsForRoleTemplate(
        {},
        invitePracticePayload,
        inviteRoleTemplate,
      );
      const practiceNamesForEmail = formatPracticeIdsAsCommaNames(
        invitePracticePayload,
        practices,
      );
      const res = await inviteFirebaseUser(idToken, {
        email: inviteEmail.trim(),
        displayName: inviteDisplayName.trim() || undefined,
        initialClaims,
        personalMessage: invitePersonalMessage.trim() || undefined,
        practiceNamesForEmail: practiceNamesForEmail || undefined,
      });
      showToast(
        res.message ??
          (res.emailSent
            ? `Invite email sent to ${res.email}.`
            : `User created (${res.email}). Configure the backend to send branded email.`),
      );
      setShowInviteUser(false);
      setInviteEmail("");
      setInviteDisplayName("");
      setInvitePersonalMessage("");
      setInviteRoleTemplate("staff");
      if (showSuperAdminPracticePicker) {
        setSuperAdminPracticeSelectionIds([]);
      }
      void loadUsers(null, false);
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : "Could not send invitation.",
      );
    } finally {
      setInviteSaving(false);
    }
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAddError(null);
    if (!addEmail.trim() || addPassword.length < 6) {
      setAddError("Email and password (6+ characters) are required.");
      return;
    }
    setAddSaving(true);
    try {
      if (resolvedStaffPracticeIds.length === 0) {
        setAddError(
          showSuperAdminPracticePicker && practices.length > 0
            ? "Select at least one practice location."
            : "No practice locations are available. Check the practice directory or your admin account.",
        );
        setAddSaving(false);
        return;
      }
      const idToken = await user.getIdToken();
      const addPracticePayload = resolvedStaffPracticeIds;
      const initialClaims = buildClaimsForRoleTemplate(
        {},
        addPracticePayload,
        addRoleTemplate,
      );
      const created = await createFirebaseUser(idToken, {
        email: addEmail.trim(),
        password: addPassword,
        displayName: addDisplayName.trim() || undefined,
        initialClaims,
      });
      setUsers((prev) => [created, ...prev]);
      showToast("User created.");
      setShowAddUser(false);
      setAddEmail("");
      setAddPassword("");
      setAddDisplayName("");
      setAddRoleTemplate("staff");
      if (showSuperAdminPracticePicker) {
        setSuperAdminPracticeSelectionIds([]);
      }
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddSaving(false);
    }
  };

  const cancelManageEmailEdit = useCallback(() => {
    if (!editingUid) return;
    const row = users.find((x) => x.uid === editingUid);
    setEditEmail(row?.email ?? "");
    setManageEmailUnlocked(false);
  }, [editingUid, users]);

  useEffect(() => {
    if (!editingUid) setManageEmailUnlocked(false);
  }, [editingUid]);

  const saveEdits = async () => {
    if (!user || !editingUid) return;
    setSaving(true);
    setSaveError(null);
    if (!editEmail.trim()) {
      setSaveError("Email is required.");
      setSaving(false);
      return;
    }
    try {
      const idToken = await user.getIdToken();
      const row = users.find((x) => x.uid === editingUid);
      if (!row) throw new Error("User not found.");
      const existing = row?.customClaims ?? {};
      const rowPracticeIds = getPracticeIdsFromClaims(existing);
      let practiceIdsForSave: string[];
      if (viewerIsPracticeScoped) {
        const external = rowPracticeIds.filter(
          (id) => !viewerPracticeIds.includes(id),
        );
        const managed = [...viewerPracticeIds];
        practiceIdsForSave = [...new Set([...external, ...managed])];
      } else {
        practiceIdsForSave = [...resolvedStaffPracticeIds];
      }
      if (practiceIdsForSave.length === 0) {
        setSaveError(
          showSuperAdminPracticePicker && practices.length > 0
            ? "Select at least one practice location."
            : "No practice locations are available. Load the practice directory or set practiceIds on your admin account.",
        );
        setSaving(false);
        return;
      }
      const merged = buildClaimsForRoleTemplate(
        existing,
        practiceIdsForSave,
        editRoleTemplate,
      );
      const patch: { displayName?: string | null; email?: string } = {};
      const nextEmail = editEmail.trim();
      const nextDisplayName = editDisplayName.trim();
      if (nextEmail !== (row.email ?? "")) {
        patch.email = nextEmail;
      }
      if (nextDisplayName !== (row.displayName ?? "")) {
        patch.displayName = nextDisplayName || null;
      }
      if (Object.keys(patch).length > 0) {
        await patchFirebaseUser(idToken, editingUid, patch);
      }
      await setFirebaseUserCustomClaims(idToken, editingUid, merged);
      setUsers((prev) =>
        prev.map((r) =>
          r.uid === editingUid
            ? {
                ...r,
                email: patch.email ?? r.email,
                displayName:
                  "displayName" in patch ? (patch.displayName ?? null) : r.displayName,
                customClaims: merged as Record<string, unknown>,
              }
            : r,
        ),
      );
      if (manageOpenedFromDetail) {
        setDetailUserUid(editingUid);
      }
      setManageEmailUnlocked(false);
      setEditingUid(null);
      showToast("User updated.");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className={rootClass(embedded)}>
        <p>
          Users and Roles is not available in this build (set{" "}
          <code>VITE_FIREBASE_*</code> env vars).
        </p>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className={rootClass(embedded, "firebase-admin-page--center")}>
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={rootClass(embedded)}>
        <div className="firebase-admin-page__card">
          <h1 className="firebase-admin-page__title">Users and Roles</h1>
          <p className="firebase-admin-page__lead">
            Sign in with an account that is allowed to use the admin API (see server{" "}
            <code>FIREBASE_SUPERADMIN_UIDS</code> or the permission flag{" "}
            <code>admin: true</code> on your account).
          </p>
          <div className="firebase-admin-page__guide-wrap-login">
            <FirebaseAdminGuide summaryLabel="How to use this page" />
          </div>
          <form onSubmit={handleSignIn} className="firebase-admin-page__form">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {signInError && (
              <p className="firebase-admin-page__error" role="alert">
                {signInError}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={signingIn}>
              {signingIn ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="firebase-admin-page__back">
            {embedded && onLeaveEmbedded ? (
              <button
                type="button"
                className="firebase-admin-page__back-link-btn"
                onClick={onLeaveEmbedded}
              >
                ← Back to dashboard
              </button>
            ) : (
              <a href="/">← Back to dashboard login</a>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass(embedded)}>
      <header
        className={
          embedded
            ? "firebase-admin-page__header firebase-admin-page__header--embedded"
            : "firebase-admin-page__header"
        }
      >
        <div>
          {embedded ? (
            <p className="firebase-admin-page__embedded-kicker">
              {viewerIsSuperAdmin === true
                ? "Manage accounts, roles, and invites"
                : viewerCanDisableUsers
                  ? "Invite and manage staff access"
                  : viewerCanUseDirectory
                    ? "Invite teammates and edit access"
                    : "Staff accounts (view only)"}
            </p>
          ) : (
            <h1 className="firebase-admin-page__title">Users and Roles</h1>
          )}
          <p className="firebase-admin-page__meta">
            Signed in as <strong>{user.email}</strong>
            {backendReady === null && (
              <span className="firebase-admin-page__warn"> — Checking backend…</span>
            )}
            {backendReady === false && (
              <span className="firebase-admin-page__warn">
                {" "}
                — Backend reports the account admin API is not configured (check server env).
              </span>
            )}
          </p>
        </div>
        {!embedded && (
          <div className="firebase-admin-page__header-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => signOutFirebase()}
            >
              Sign out
            </button>
            <a href="/" className="btn-secondary firebase-admin-page__back-link">
              Dashboard
            </a>
          </div>
        )}
      </header>

      {practicesError && (
        <p className="firebase-admin-page__error" role="alert">
          Practice directory: {practicesError}
        </p>
      )}

      {listError && (
        <p className="firebase-admin-page__error" role="alert">
          {listError}
        </p>
      )}

      {backendReady === false && (
        <p className="firebase-admin-page__error" role="alert">
          The API reports account management is not configured on the server. Set
          service account env vars on the backend and redeploy, then reload this page.
        </p>
      )}

      {backendReady === true && (
      <section className="firebase-admin-page__section">
        <>
              <div className="firebase-admin-page__section-heading">
                <div>
                  <h2>Users</h2>
                </div>
                <p className="firebase-admin-page__toolbar-meta" aria-live="polite">
                  {firebaseAdminUserCountMeta}
                  {listLoading && " — loading…"}
                </p>
              </div>
              <div ref={toolbarControlsRef} className="firebase-admin-page__toolbar-controls">
                <div className="firebase-admin-page__toolbar">
                  {viewerIsSuperAdmin === true && (
                    <button
                      type="button"
                      className="btn-secondary firebase-admin-page__add-user-btn"
                      onClick={() => {
                        setShowInviteUser(false);
                        setInviteError(null);
                        setShowAddUser(true);
                        setAddError(null);
                        if (showSuperAdminPracticePicker) {
                          setSuperAdminPracticeSelectionIds([]);
                        }
                      }}
                    >
                      Add user
                    </button>
                  )}
                  {viewerCanUseDirectory && (
                    <button
                      type="button"
                      className="btn-primary firebase-admin-page__add-user-btn"
                      onClick={() => {
                        setShowAddUser(false);
                        setAddError(null);
                        setShowInviteUser(true);
                        setInviteError(null);
                        if (showSuperAdminPracticePicker) {
                          setSuperAdminPracticeSelectionIds([]);
                        }
                      }}
                    >
                      Invite user
                    </button>
                  )}
                  <div className="firebase-admin-page__search-wrap">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input
                      type="search"
                      className={`firebase-admin-page__toolbar-search${
                        listSearch.trim()
                          ? " firebase-admin-page__toolbar-search--has-clear"
                          : ""
                      }`}
                      placeholder={
                        viewerIsSuperAdmin === true
                          ? "Search email, UID, name, role..."
                          : "Search email, name, role..."
                      }
                      aria-label="Search loaded users"
                      value={listSearch}
                      onChange={(e) => setListSearch(e.target.value)}
                      autoComplete="off"
                    />
                    {listSearch.trim() ? (
                      <button
                        type="button"
                        className="firebase-admin-page__search-clear"
                        aria-label="Clear search"
                        title="Clear search"
                        onClick={() => setListSearch("")}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={`firebase-admin-page__control-btn firebase-admin-page__filters-btn${
                      firebaseAdminFilterTags.length > 0
                        ? " firebase-admin-page__control-btn--active firebase-admin-page__filters-btn--active"
                        : ""
                    }`}
                    aria-expanded={showFilters}
                    aria-controls="firebase-admin-filter-popover"
                    onClick={() => {
                      setShowFilters((v) => !v);
                      setShowSort(false);
                    }}
                  >
                    <span>
                      Filters
                      {firebaseAdminFilterTags.length > 0
                        ? ` (${firebaseAdminFilterTags.length})`
                        : ""}
                    </span>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="firebase-admin-page__control-icon"
                      aria-hidden="true"
                    >
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`firebase-admin-page__control-btn firebase-admin-page__sort-btn${
                      showSort ? " firebase-admin-page__control-btn--open" : ""
                    }`}
                    aria-expanded={showSort}
                    aria-controls="firebase-admin-sort-popover"
                    aria-label={`Sort users: ${SORT_LABELS[sortKey]}`}
                    onClick={() => {
                      setShowSort((v) => !v);
                      setShowFilters(false);
                    }}
                  >
                    <span>Sort</span>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="firebase-admin-page__control-icon"
                      aria-hidden="true"
                    >
                      <line x1="4" y1="6" x2="16" y2="6"></line>
                      <line x1="4" y1="12" x2="13" y2="12"></line>
                      <line x1="4" y1="18" x2="10" y2="18"></line>
                      <polyline points="18 15 21 18 18 21"></polyline>
                      <line x1="21" y1="18" x2="21" y2="9"></line>
                    </svg>
                  </button>
                </div>
                <div className="firebase-admin-page__popover-row">
                  {showFilters && (
                    <div
                      id="firebase-admin-filter-popover"
                      className="firebase-admin-page__popover firebase-admin-page__popover--filters"
                    >
                    <div className="firebase-admin-page__popover-header">
                      <div>
                        <h3>Filter users</h3>
                        <p>
                          Refine the loaded list. With <strong>All accounts</strong>, active
                          and disabled rows appear in separate table sections — no filter
                          chip until you narrow further.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="firebase-admin-page__popover-close"
                        aria-label="Close filters"
                        onClick={() => setShowFilters(false)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="firebase-admin-page__filter-grid">
                      <div className="firebase-admin-page__filter-panel-item filter-group">
                        <label htmlFor="firebase-admin-filter-account">
                          Account status
                        </label>
                        <FilterSelect
                          id="firebase-admin-filter-account"
                          aria-label="Filter by account status"
                          value={filterDisabled}
                          onChange={(v) =>
                            setFilterDisabled(v as "all" | "yes" | "no")
                          }
                          options={FILTER_ACCOUNT_STATUS_OPTIONS}
                        />
                      </div>
                      <div className="firebase-admin-page__filter-panel-item filter-group">
                        <label htmlFor="firebase-admin-filter-role">Role</label>
                        <FilterSelect
                          id="firebase-admin-filter-role"
                          aria-label="Filter by role"
                          value={filterRole}
                          onChange={(v) =>
                            setFilterRole(v as "all" | DashboardRoleTemplate)
                          }
                          options={roleFilterSelectOptions}
                        />
                      </div>
                      <div className="firebase-admin-page__filter-panel-item filter-group">
                        <label htmlFor="firebase-admin-filter-signin">
                          First sign-in
                        </label>
                        <FilterSelect
                          id="firebase-admin-filter-signin"
                          aria-label="Filter by first sign-in status"
                          value={filterFirstSignIn}
                          onChange={(v) =>
                            setFilterFirstSignIn(
                              v as "all" | "pending" | "signed_in",
                            )
                          }
                          options={FILTER_FIRST_SIGN_IN_OPTIONS}
                        />
                      </div>
                      <div className="firebase-admin-page__filter-panel-item filter-group">
                        <label htmlFor="firebase-admin-filter-verified">
                          Email verified
                        </label>
                        <FilterSelect
                          id="firebase-admin-filter-verified"
                          aria-label="Filter by email verified"
                          value={filterVerified}
                          onChange={(v) =>
                            setFilterVerified(v as "all" | "yes" | "no")
                          }
                          options={FILTER_VERIFIED_OPTIONS}
                        />
                      </div>
                    </div>
                    <div className="firebase-admin-page__popover-actions">
                      {firebaseAdminFilterTags.length > 0 && (
                        <button
                          type="button"
                          className="firebase-admin-page__filter-clear"
                          onClick={clearFirebaseAdminFilters}
                        >
                          Clear filters
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-secondary firebase-admin-page__popover-done"
                        onClick={() => setShowFilters(false)}
                      >
                        Done
                      </button>
                    </div>
                    </div>
                  )}
                  {showSort && (
                    <div
                      id="firebase-admin-sort-popover"
                      className="firebase-admin-page__popover firebase-admin-page__popover--sort"
                    >
                    <div className="firebase-admin-page__popover-header">
                      <div>
                        <h3>Sort users</h3>
                        <p>Choose a stable order for the table.</p>
                      </div>
                      <button
                        type="button"
                        className="firebase-admin-page__popover-close"
                        aria-label="Close sort"
                        onClick={() => setShowSort(false)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="firebase-admin-page__sort-filter-wrap filter-group">
                      <label htmlFor="firebase-admin-sort-select">
                        Table order
                      </label>
                      <FilterSelect
                        id="firebase-admin-sort-select"
                        aria-label="Sort users"
                        value={sortKey}
                        onChange={(v) => {
                          setSortKey(v as SortKey);
                          setShowSort(false);
                        }}
                        options={SORT_FILTER_SELECT_OPTIONS}
                      />
                    </div>
                    </div>
                  )}
                </div>
              </div>
              {firebaseAdminFilterTags.length > 0 && (
                <div
                  className="filter-active-summary firebase-admin-page__filter-active-summary"
                  role="status"
                  aria-live="polite"
                  aria-label="Active filters"
                >
                  <div className="filter-active-summary-inner">
                    <span className="filter-active-summary-heading">Filtered by</span>
                    <ul className="filter-active-summary-chips">
                      {firebaseAdminFilterTags.map((tag, i) => (
                        <li key={`${i}-${tag}`} className="filter-active-summary-chip">
                          {tag}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="btn-secondary btn-sm filter-clear-btn filter-clear-btn--active filter-active-summary-clear"
                      onClick={clearFirebaseAdminFilters}
                    >
                      Clear filters
                    </button>
                  </div>
                </div>
              )}
        </>

        {viewerIsSuperAdmin === true && showAddUser && (
          <div
            className="firebase-admin-page__modal-backdrop"
            role="presentation"
            onClick={() => {
              if (!addSaving) closeAddUserModal();
            }}
          >
            <div
              className="firebase-admin-page__modal firebase-admin-page__modal--wide"
              role="dialog"
              aria-modal="true"
              aria-labelledby="firebase-admin-add-user-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="firebase-admin-page__modal-header">
                <h2
                  id="firebase-admin-add-user-title"
                  className="firebase-admin-page__modal-title"
                >
                  Create user
                </h2>
                <button
                  type="button"
                  className="firebase-admin-page__modal-close"
                  aria-label="Close"
                  disabled={addSaving}
                  onClick={closeAddUserModal}
                >
                  ×
                </button>
              </div>
              <form onSubmit={(e) => void handleCreateUser(e)}>
                <div className="firebase-admin-page__add-grid">
                  <label>
                    Email *
                    <input
                      type="email"
                      autoComplete="off"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Password * (min 6 characters)
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={addPassword}
                      onChange={(e) => setAddPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </label>
                  <label className="firebase-admin-page__add-span2">
                    Display name (optional)
                    <input
                      type="text"
                      value={addDisplayName}
                      onChange={(e) => setAddDisplayName(e.target.value)}
                    />
                  </label>
                  <div className="firebase-admin-page__add-span2 firebase-admin-page__modal-role-field filter-group">
                    <label htmlFor="firebase-admin-add-role">Access level</label>
                    <FilterSelect
                      id="firebase-admin-add-role"
                      aria-label="Access level for new user"
                      value={addRoleTemplate}
                      onChange={(v) =>
                        setAddRoleTemplate(v as DashboardRoleTemplate)
                      }
                      options={ADD_USER_ROLE_OPTIONS}
                    />
                  </div>
                  {showSuperAdminPracticePicker ? (
                    <div className="firebase-admin-page__add-span2 firebase-admin-page__practice-picker-block">
                      <span className="firebase-admin-page__signin-help-label">
                        Practice access *
                      </span>
                      <p className="firebase-admin-page__muted firebase-admin-page__practice-picker-lede">
                        Choose which locations this user can access. Nothing is selected by
                        default.
                      </p>
                      <SuperAdminPracticePicker
                        idPrefix="add-user"
                        practices={practices}
                        selectedIds={superAdminPracticeSelectionIds}
                        onToggle={toggleSuperAdminPracticeId}
                        disabled={addSaving}
                      />
                    </div>
                  ) : (
                    <p className="firebase-admin-page__add-span2 firebase-admin-page__practice-scope-note">
                      <strong>Practice access:</strong>{" "}
                      {resolvedStaffPracticeIds.length > 0
                        ? formatPracticeNamesForRow(
                            { practiceIds: resolvedStaffPracticeIds },
                            practices,
                          )
                        : "—"}
                      . New accounts use the locations tied to your admin account.
                    </p>
                  )}
                </div>
                {addError && (
                  <p className="firebase-admin-page__error" role="alert">
                    {addError}
                  </p>
                )}
                <div className="firebase-admin-page__modal-actions firebase-admin-page__modal-actions--align-end">
                  <button type="submit" className="btn-primary" disabled={addSaving}>
                    {addSaving ? "Creating…" : "Create user"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {viewerCanUseDirectory && showInviteUser && (
          <div
            className="firebase-admin-page__modal-backdrop"
            role="presentation"
            onClick={() => {
              if (!inviteSaving) closeInviteUserModal();
            }}
          >
            <div
              className="firebase-admin-page__modal firebase-admin-page__modal--wide firebase-admin-page__modal--invite"
              role="dialog"
              aria-modal="true"
              aria-labelledby="firebase-admin-invite-user-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="firebase-admin-page__modal-header">
                <h2
                  id="firebase-admin-invite-user-title"
                  className="firebase-admin-page__modal-title"
                >
                  Invite user by email
                </h2>
                <button
                  type="button"
                  className="firebase-admin-page__modal-close"
                  aria-label="Close"
                  disabled={inviteSaving}
                  onClick={closeInviteUserModal}
                >
                  ×
                </button>
              </div>
              <p className="firebase-admin-page__invite-lead">
                {viewerIsSuperAdmin === true ? (
                  <>
                    Sends a link so they can set their password and sign in. Requires the
                    backend route <code>POST /api/admin/firebase/users/invite</code> (see
                    server reference). Email design and sender domain are configured on the
                    server.
                  </>
                ) : (
                  <>
                    Sends an email with a link so they can set their password and sign in.
                    If nothing arrives, check spam or contact your technical administrator.
                  </>
                )}
              </p>
              <form onSubmit={(e) => void handleInviteUser(e)}>
                <div className="firebase-admin-page__add-grid">
                  <label>
                    Email *
                    <input
                      type="email"
                      autoComplete="off"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Display name (optional)
                    <input
                      type="text"
                      value={inviteDisplayName}
                      onChange={(e) => setInviteDisplayName(e.target.value)}
                    />
                  </label>
                  <div className="firebase-admin-page__add-span2 firebase-admin-page__modal-role-field filter-group">
                    <label htmlFor="firebase-admin-invite-role">Access level</label>
                    <FilterSelect
                      id="firebase-admin-invite-role"
                      aria-label="Access level for invited user"
                      value={inviteRoleTemplate}
                      onChange={(v) =>
                        setInviteRoleTemplate(v as DashboardRoleTemplate)
                      }
                      options={assignableRoleSelectOptions}
                    />
                  </div>
                  <label className="firebase-admin-page__add-span2">
                    Personal note (optional, included in invite email if supported)
                    <textarea
                      className="firebase-admin-page__invite-note"
                      rows={3}
                      value={invitePersonalMessage}
                      onChange={(e) => setInvitePersonalMessage(e.target.value)}
                      placeholder="Welcome to the team…"
                    />
                  </label>
                  {showSuperAdminPracticePicker ? (
                    <div className="firebase-admin-page__add-span2 firebase-admin-page__practice-picker-block">
                      <span className="firebase-admin-page__signin-help-label">
                        Practice access *
                      </span>
                      <p className="firebase-admin-page__muted firebase-admin-page__practice-picker-lede">
                        Choose which locations this invite can access. Nothing is selected by
                        default.
                      </p>
                      <SuperAdminPracticePicker
                        idPrefix="invite-user"
                        practices={practices}
                        selectedIds={superAdminPracticeSelectionIds}
                        onToggle={toggleSuperAdminPracticeId}
                        disabled={inviteSaving}
                      />
                    </div>
                  ) : (
                    <p className="firebase-admin-page__add-span2 firebase-admin-page__practice-scope-note">
                      <strong>Practice access:</strong>{" "}
                      {resolvedStaffPracticeIds.length > 0
                        ? formatPracticeNamesForRow(
                            { practiceIds: resolvedStaffPracticeIds },
                            practices,
                          )
                        : "—"}
                      . Invited accounts use the locations tied to your admin account.
                    </p>
                  )}
                </div>
                {inviteError && (
                  <p className="firebase-admin-page__error" role="alert">
                    {inviteError}
                  </p>
                )}
                <div className="firebase-admin-page__modal-actions firebase-admin-page__modal-actions--align-end">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={inviteSaving}
                  >
                    {inviteSaving ? "Sending…" : "Send invitation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="firebase-admin-page__table-wrap">
          <table className="firebase-admin-page__table">
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Display name</th>
                <th scope="col">Last sign-in</th>
                {viewerIsSuperAdmin === true && (
                  <>
                    <th scope="col">UID</th>
                    <th scope="col">Disabled</th>
                  </>
                )}
                <th scope="col">Role</th>
                <th scope="col" className="firebase-admin-page__th-actions-simple">Actions</th>
              </tr>
            </thead>
            <tbody>
              {directoryTableShowsEmpty ? (
                <tr>
                  <td
                    colSpan={directoryTableColSpan}
                    className="firebase-admin-page__empty-filter"
                  >
                    No users match the current search or filters.
                  </td>
                </tr>
              ) : filterDisabled === "all" ? (
                <>
                  {splitActiveUsers.length > 0 && splitDisabledUsers.length > 0 && (
                    <tr className="firebase-admin-page__table-section-row">
                      <td
                        colSpan={directoryTableColSpan}
                        className="firebase-admin-page__table-section-label"
                      >
                        Active accounts
                      </td>
                    </tr>
                  )}
                  {splitActiveUsers.map((u) => (
                    <FirebaseAdminDirectoryRow
                      key={`active-${u.uid}`}
                      u={u}
                      viewerIsSuperAdmin={viewerIsSuperAdmin}
                      actionBusyUid={actionBusyUid}
                      canManage={canManageUserRow(u)}
                      onManage={openEdit}
                      onView={setDetailUserUid}
                    />
                  ))}
                  {splitDisabledUsers.length > 0 && (
                    <>
                      <tr className="firebase-admin-page__table-section-row">
                        <td
                          colSpan={directoryTableColSpan}
                          className="firebase-admin-page__table-section-label"
                        >
                          Disabled accounts
                        </td>
                      </tr>
                      {splitDisabledUsers.map((u) => (
                        <FirebaseAdminDirectoryRow
                          key={`disabled-${u.uid}`}
                          u={u}
                          viewerIsSuperAdmin={viewerIsSuperAdmin}
                          actionBusyUid={actionBusyUid}
                          canManage={canManageUserRow(u)}
                          onManage={openEdit}
                          onView={setDetailUserUid}
                        />
                      ))}
                    </>
                  )}
                </>
              ) : (
                filteredUsers.map((u) => (
                  <FirebaseAdminDirectoryRow
                    key={u.uid}
                    u={u}
                    viewerIsSuperAdmin={viewerIsSuperAdmin}
                    actionBusyUid={actionBusyUid}
                    canManage={canManageUserRow(u)}
                    onManage={openEdit}
                    onView={setDetailUserUid}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {pageToken && (
          <div className="firebase-admin-page__pager">
            <button
              type="button"
              className="btn-secondary"
              disabled={listLoading}
              onClick={() => {
                void loadUsers(pageToken, true);
              }}
            >
              {listLoading ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </section>
      )}

      {detailUserUid && detailUserRow && (() => {
        const detailTargetIsSuperAdmin =
          getDashboardRoleFromClaims(detailUserRow.customClaims) ===
          "super_admin";

        return (
        <div
          className="firebase-admin-page__modal-backdrop"
          role="presentation"
          onClick={() => setDetailUserUid(null)}
        >
          <div
            className="firebase-admin-page__modal firebase-admin-page__modal--user-panel firebase-admin-page__modal--user-detail"
            role="dialog"
            aria-labelledby="user-detail-title"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="firebase-admin-page__modal-header">
              <h2
                id="user-detail-title"
                className="firebase-admin-page__modal-title"
              >
                User overview
              </h2>
              <button
                type="button"
                className="firebase-admin-page__modal-close"
                aria-label="Close"
                onClick={() => setDetailUserUid(null)}
              >
                ×
              </button>
            </div>
            <div className="firebase-admin-page__user-panel-hero">
              <p className="firebase-admin-page__user-panel-display">
                {detailUserRow.displayName?.trim() ||
                  detailUserRow.email ||
                  "No email"}
              </p>
              {detailUserRow.displayName?.trim() && detailUserRow.email ? (
                <p className="firebase-admin-page__user-panel-email">
                  {detailUserRow.email}
                </p>
              ) : null}
              <div className="firebase-admin-page__user-panel-pills">
                <span
                  className={`firebase-admin-page__pill ${
                    detailUserRow.emailVerified
                      ? "firebase-admin-page__pill--ok"
                      : "firebase-admin-page__pill--pending"
                  }`}
                >
                  {detailUserRow.emailVerified ? "Email verified" : "Email not verified"}
                </span>
                <span
                  className={`firebase-admin-page__pill ${
                    detailUserRow.disabled
                      ? "firebase-admin-page__pill--pending"
                      : "firebase-admin-page__pill--ok"
                  }`}
                >
                  {detailUserRow.disabled ? "Disabled" : "Active"}
                </span>
                {isPendingFirstSignIn(detailUserRow) ? (
                  <span className="firebase-admin-page__pill firebase-admin-page__pill--pending">
                    Not signed in yet
                  </span>
                ) : (
                  <span className="firebase-admin-page__pill firebase-admin-page__pill--ok">
                    Has signed in
                  </span>
                )}
              </div>
            </div>

            <div className="firebase-admin-page__overview-extra">
              <dl className="firebase-admin-page__overview-meta">
                <dt>Member since</dt>
                <dd>{formatAuthTime(detailUserRow.creationTime)}</dd>
                {viewerIsSuperAdmin === true && (
                  <>
                    <dt>UID</dt>
                    <dd className="firebase-admin-page__mono">{detailUserRow.uid}</dd>
                  </>
                )}
              </dl>
            </div>

            {detailTargetIsSuperAdmin && viewerIsSuperAdmin !== true && (
              <p className="firebase-admin-page__hint firebase-admin-page__hint--tight">
                This account is managed by your organization&apos;s technical administrators.
                You cannot change its permissions here.
              </p>
            )}
          </div>
        </div>
        );
      })()}

      {linkModal && (
        <div
          className="firebase-admin-page__modal-backdrop"
          role="presentation"
          onClick={() => setLinkModal(null)}
        >
          <div
            className="firebase-admin-page__modal firebase-admin-page__modal--wide"
            role="dialog"
            aria-labelledby="link-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="firebase-admin-page__modal-header">
              <h2 id="link-modal-title" className="firebase-admin-page__modal-title">
                {linkModal.title}
              </h2>
              <button
                type="button"
                className="firebase-admin-page__modal-close"
                aria-label="Close"
                onClick={() => setLinkModal(null)}
              >
                ×
              </button>
            </div>
            <p className="firebase-admin-page__muted">
              For <strong>{linkModal.email}</strong>
            </p>
            {linkModal.hint && (
              <p className="firebase-admin-page__hint">{linkModal.hint}</p>
            )}
            <label className="firebase-admin-page__label-block" htmlFor="link-modal-url">
              One-time link (copy and send through a channel you trust)
            </label>
            <textarea
              id="link-modal-url"
              className="firebase-admin-page__link-textarea"
              readOnly
              rows={4}
              value={linkModal.link}
            />
            <div className="firebase-admin-page__modal-actions firebase-admin-page__modal-actions--align-end">
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(linkModal.link);
                    showToast("Copied to clipboard");
                  } catch {
                    showError("Could not copy — select the link and copy manually");
                  }
                }}
              >
                Copy to clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUid && (
        <div
          className="firebase-admin-page__modal-backdrop"
          role="presentation"
          onClick={() => !saving && setEditingUid(null)}
        >
          <div
            className="firebase-admin-page__modal firebase-admin-page__modal--user-panel firebase-admin-page__modal--manage-user"
            role="dialog"
            aria-labelledby="edit-user-title"
            onClick={(e) => e.stopPropagation()}
          >
            {manageOpenedFromDetail && editingUserRow && (
              <button
                type="button"
                className="firebase-admin-page__modal-back-btn"
                disabled={saving}
                onClick={() => {
                  setEditingUid(null);
                  setDetailUserUid(editingUserRow.uid);
                }}
              >
                ← Back to overview
              </button>
            )}
            <div className="firebase-admin-page__modal-header firebase-admin-page__modal-header--manage-user">
              <div className="firebase-admin-page__manage-title-block">
                {editingUserRow ? (
                  <>
                    <h2 id="edit-user-title" className="firebase-admin-page__modal-title">
                      {editingUserRow.displayName?.trim() ||
                        editingUserRow.email ||
                        "User"}
                    </h2>
                    {editingUserRow.displayName?.trim() &&
                    editingUserRow.email?.trim() ? (
                      <p className="firebase-admin-page__manage-title-sub">
                        {editingUserRow.email}
                      </p>
                    ) : null}
                    <div
                      className="firebase-admin-page__manage-pills-row"
                      aria-label="Account status"
                    >
                      <span
                        className={`firebase-admin-page__pill ${
                          editingUserRow.disabled
                            ? "firebase-admin-page__pill--pending"
                            : "firebase-admin-page__pill--ok"
                        }`}
                      >
                        {editingUserRow.disabled ? "Disabled" : "Active"}
                      </span>
                      <span
                        className={`firebase-admin-page__pill ${
                          editingUserRow.emailVerified
                            ? "firebase-admin-page__pill--ok"
                            : "firebase-admin-page__pill--pending"
                        }`}
                      >
                        {editingUserRow.emailVerified ? "Verified" : "Unverified"}
                      </span>
                    </div>
                  </>
                ) : (
                  <h2 id="edit-user-title" className="firebase-admin-page__modal-title">
                    User
                  </h2>
                )}
              </div>
              <button
                type="button"
                className="firebase-admin-page__modal-close"
                aria-label="Close"
                disabled={saving}
                onClick={() => setEditingUid(null)}
              >
                ×
              </button>
            </div>
            <div className="firebase-admin-page__manage-section firebase-admin-page__manage-section--profile">
              <h3 className="firebase-admin-page__sr-only">Account</h3>
              <div className="firebase-admin-page__manage-grid">
                {editingUserRow?.email?.trim() && !manageEmailUnlocked ? (
                  <div className="firebase-admin-page__manage-email-gated">
                    <span className="firebase-admin-page__signin-help-label">
                      Email
                    </span>
                    <div className="firebase-admin-page__manage-email-locked-row">
                      <span className="firebase-admin-page__manage-email-readonly">
                        {editEmail}
                      </span>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={saving}
                        title="Unlock only when you intend to change this sign-in address"
                        onClick={() => setManageEmailUnlocked(true)}
                      >
                        Change email
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="firebase-admin-page__manage-email-editing">
                    <label>
                      Email
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        disabled={saving}
                        autoComplete="off"
                      />
                    </label>
                    {editingUserRow?.email?.trim() && manageEmailUnlocked ? (
                      <button
                        type="button"
                        className="firebase-admin-page__manage-email-cancel"
                        disabled={saving}
                        onClick={cancelManageEmailEdit}
                      >
                        Cancel email change
                      </button>
                    ) : null}
                  </div>
                )}
                <label>
                  Display name
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    disabled={saving}
                    placeholder="Optional"
                    autoComplete="name"
                  />
                </label>
              </div>
            </div>

            <div className="firebase-admin-page__manage-section firebase-admin-page__manage-section--access">
              <h3 className="firebase-admin-page__manage-section-title">Role</h3>
              <div className="firebase-admin-page__manage-access-body">
                <div className="firebase-admin-page__manage-access-role filter-group">
                  <label htmlFor="firebase-admin-manage-role">Access level</label>
                  <FilterSelect
                    id="firebase-admin-manage-role"
                    aria-label="User role"
                    value={editRoleTemplate}
                    onChange={(v) =>
                      setEditRoleTemplate(v as DashboardRoleTemplate)
                    }
                    options={assignableRoleSelectOptions}
                  />
                </div>
                {viewerIsPracticeScoped &&
                  editingExternalPracticeIds.length > 0 && (
                    <p className="firebase-admin-page__manage-muted-footnote firebase-admin-page__manage-muted-footnote--strong firebase-admin-page__manage-practices-note">
                      Also linked by an org admin:{" "}
                      <strong>
                        {formatPracticeNamesForRow(
                          { practiceIds: editingExternalPracticeIds },
                          practices,
                        )}
                      </strong>
                    </p>
                  )}
              </div>
            </div>

            {showSuperAdminPracticePicker && editingUserRow ? (
              <div className="firebase-admin-page__manage-section firebase-admin-page__manage-section--practices">
                <h3 className="firebase-admin-page__manage-section-title">
                  Practice access
                </h3>
                <p className="firebase-admin-page__muted firebase-admin-page__practice-picker-lede">
                  Locations this user can access. Saved with{" "}
                  <strong>Save changes</strong>.
                </p>
                <SuperAdminPracticePicker
                  idPrefix="manage-user"
                  practices={practices}
                  selectedIds={superAdminPracticeSelectionIds}
                  onToggle={toggleSuperAdminPracticeId}
                  disabled={saving}
                />
              </div>
            ) : null}

            {editingUserRow ? (
              <details
                className="firebase-admin-page__manage-details firebase-admin-page__manage-details--signin"
                open={manageSignInExtrasOpen}
                onToggle={(e) =>
                  setManageSignInExtrasOpen(
                    (e.currentTarget as HTMLDetailsElement).open,
                  )
                }
              >
                <summary className="firebase-admin-page__manage-details-summary">
                  <span>Sign-in &amp; password</span>
                  {manageSignInExtrasAttention.needsAttention ? (
                    <span
                      className="firebase-admin-page__manage-details-badge firebase-admin-page__manage-details-badge--signin-followup"
                      title="Open this section for resend invite, password reset, or verification link."
                    >
                      {manageSignInExtrasAttention.summary}
                    </span>
                  ) : null}
                </summary>
                <div className="firebase-admin-page__manage-details-body firebase-admin-page__manage-details-body--signin">
                  {viewerCanUseDirectory &&
                    editingUserRow.email &&
                    !editingUserRow.disabled &&
                    isPendingFirstSignIn(editingUserRow) && (
                      <p
                        className="firebase-admin-page__manage-muted firebase-admin-page__manage-signin-lede"
                        role="status"
                      >
                        First sign-in is not done yet. If they lost the original
                        email, resend the invite or send a password reset / copy a
                        fresh sign-in link.
                      </p>
                    )}
                  {editingUserRow.email && !editingUserRow.emailVerified && (
                    <p
                      className="firebase-admin-page__manage-muted firebase-admin-page__manage-signin-lede"
                      role="status"
                    >
                      {viewerIsSuperAdmin === true
                        ? "They still need to verify their email address."
                        : "Email is not verified yet. A technical administrator can issue a verification link."}
                    </p>
                  )}
                  <div className="firebase-admin-page__manage-signin-buttons">
                    {viewerCanUseDirectory &&
                      isPendingFirstSignIn(editingUserRow) &&
                      editingUserRow.email &&
                      !editingUserRow.disabled && (
                        <div className="firebase-admin-page__manage-invite-action-bundle">
                          <p className="firebase-admin-page__manage-invite-action-hint">
                            Invite pending
                          </p>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={actionBusyUid === editingUserRow.uid}
                            onClick={() =>
                              void handleResendInviteEmail(editingUserRow)
                            }
                          >
                            Resend invite
                          </button>
                        </div>
                      )}
                    {editingUserRow.email && !editingUserRow.disabled && (
                      <>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={actionBusyUid === editingUserRow.uid}
                          onClick={() =>
                            void handleSendPasswordResetEmail(editingUserRow)
                          }
                        >
                          Email reset
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={actionBusyUid === editingUserRow.uid}
                          title="Opens a dialog with a one-time URL so this user can set a new password (share by text or another channel)."
                          onClick={() => {
                            const u = editingUserRow;
                            setEditingUid(null);
                            void openPasswordResetLink(u);
                          }}
                        >
                          Copy password reset link
                        </button>
                      </>
                    )}
                    {viewerIsSuperAdmin === true &&
                      editingUserRow?.email &&
                      !editingUserRow.emailVerified && (
                        <div className="firebase-admin-page__manage-verify-row">
                          <span className="firebase-admin-page__manage-action-near-btn-label">
                            Unverified
                          </span>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={actionBusyUid === editingUserRow.uid}
                            onClick={() => {
                              const u = editingUserRow;
                              setEditingUid(null);
                              void openEmailVerifyLink(u);
                            }}
                          >
                            Verification link
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              </details>
            ) : null}

            {viewerIsSuperAdmin === true && editingUserRow ? (
              <details className="firebase-admin-page__manage-details firebase-admin-page__manage-details--more">
                <summary className="firebase-admin-page__manage-details-summary">
                  Advanced
                </summary>
                <div className="firebase-admin-page__manage-details-body firebase-admin-page__manage-details-body--stack">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={actionBusyUid === editingUserRow.uid}
                    onClick={() => void handleRevokeSessions(editingUserRow)}
                  >
                    Sign out everywhere
                  </button>
                </div>
              </details>
            ) : null}
            {saveError && (
              <p className="firebase-admin-page__error" role="alert">
                {saveError}
              </p>
            )}
            <div className="firebase-admin-page__modal-actions firebase-admin-page__modal-actions--align-end">
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void saveEdits()}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
            {editingUserRow ? (
              <div className="firebase-admin-page__manage-user-footer-account">
                <p className="firebase-admin-page__muted firebase-admin-page__manage-footer-account-lede">
                  Disabled users cannot sign in until the account is enabled again.
                </p>
                <button
                  type="button"
                  className="btn-secondary firebase-admin-page__detail-tool-danger firebase-admin-page__manage-disable-account-btn"
                  disabled={
                    saving ||
                    actionBusyUid === editingUserRow.uid ||
                    !viewerCanDisableUsers ||
                    !canManageUserRow(editingUserRow)
                  }
                  title={
                    !viewerCanDisableUsers
                      ? "Only practice admins and technical administrators can disable accounts."
                      : !canManageUserRow(editingUserRow)
                        ? "You cannot change access for this account."
                        : undefined
                  }
                  onClick={() => {
                    if (
                      saving ||
                      actionBusyUid === editingUserRow.uid ||
                      !viewerCanDisableUsers ||
                      !canManageUserRow(editingUserRow)
                    ) {
                      return;
                    }
                    void handleToggleDisabled(editingUserRow);
                  }}
                >
                  {editingUserRow.disabled
                    ? "Enable account"
                    : "Disable account"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
