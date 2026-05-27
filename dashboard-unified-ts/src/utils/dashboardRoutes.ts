import type { ViewType } from "../types";

/** Deep-link targets inside client detail (query: ?section=). */
export type ClientDetailSection =
  | "mirror"
  | "analysis"
  | "recommender"
  | "quiz"
  | "blueprint";

export type DashboardRoute = {
  view: ViewType;
  clientId?: string;
  section?: ClientDetailSection;
};

const VIEW_PATHS: Record<ViewType, string> = {
  list: "/patients",
  leads: "/leads",
  kanban: "/kanban",
  cards: "/cards",
  "facial-analysis": "/facial-analysis",
  archived: "/archived",
  offers: "/offers",
  inbox: "/inbox",
  "sms-history": "/sms-history",
  settings: "/settings",
  "user-admin": "/admin/users",
};

const PATH_TO_VIEW: Record<string, ViewType> = {
  "/": "list",
  "/patients": "list",
  "/leads": "leads",
  "/kanban": "kanban",
  "/cards": "cards",
  "/facial-analysis": "facial-analysis",
  "/archived": "archived",
  "/offers": "offers",
  "/inbox": "inbox",
  "/sms-history": "sms-history",
  "/settings": "settings",
  "/admin/users": "user-admin",
};

const CLIENT_DETAIL_SECTIONS = new Set<ClientDetailSection>([
  "mirror",
  "analysis",
  "recommender",
  "quiz",
  "blueprint",
]);

function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

function parseSection(raw: string | null): ClientDetailSection | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase() as ClientDetailSection;
  return CLIENT_DETAIL_SECTIONS.has(s) ? s : undefined;
}

/** Parse `window.location` (or test pathname/search) into a dashboard route. */
export function parseDashboardRoute(
  pathname: string = typeof window !== "undefined" ? window.location.pathname : "/",
  search: string = typeof window !== "undefined" ? window.location.search : "",
): DashboardRoute | null {
  const path = normalizePath(pathname);
  const params = new URLSearchParams(search);

  const clientMatch = path.match(/^\/client-details\/([^/]+)$/);
  if (clientMatch) {
    return {
      view: parseViewFromQuery(params.get("view")) ?? "list",
      clientId: decodeURIComponent(clientMatch[1]),
      section: parseSection(params.get("section")),
    };
  }

  const view = PATH_TO_VIEW[path];
  if (!view) return null;

  return {
    view,
    section: parseSection(params.get("section")),
  };
}

function parseViewFromQuery(raw: string | null): ViewType | undefined {
  if (!raw) return undefined;
  const key = raw.trim() as ViewType;
  return Object.prototype.hasOwnProperty.call(VIEW_PATHS, key) ? key : undefined;
}

/** Build a path + search string for history.pushState (no origin). */
export function buildDashboardUrl(route: DashboardRoute): string {
  const params = new URLSearchParams();

  if (route.clientId) {
    if (route.view && route.view !== "list") {
      params.set("view", route.view);
    }
    if (route.section) params.set("section", route.section);
    const q = params.toString();
    return `/client-details/${encodeURIComponent(route.clientId)}${q ? `?${q}` : ""}`;
  }

  const base = VIEW_PATHS[route.view] ?? "/patients";
  if (route.section) params.set("section", route.section);
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

/** True when pathname is owned by the logged-in dashboard (not /aura, /tp, etc.). */
export function isDashboardAppPath(pathname?: string): boolean {
  const path = normalizePath(
    pathname ?? (typeof window !== "undefined" ? window.location.pathname : "/"),
  );
  if (path === "/" || PATH_TO_VIEW[path]) return true;
  if (/^\/client-details\/[^/]+$/.test(path)) return true;
  return false;
}

export function getViewPath(view: ViewType): string {
  return VIEW_PATHS[view] ?? "/patients";
}

/** Presentation / deck iframes: `?embed=1` hides sidebar, header, and view chrome. */
export function isDashboardEmbedMode(
  search: string = typeof window !== "undefined" ? window.location.search : "",
): boolean {
  const v = new URLSearchParams(search).get("embed")?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function withEmbedSearch(pathAndQuery: string, embed = true): string {
  if (!embed) return pathAndQuery;
  const q = pathAndQuery.indexOf("?");
  const path = q >= 0 ? pathAndQuery.slice(0, q) : pathAndQuery;
  const params = new URLSearchParams(q >= 0 ? pathAndQuery.slice(q + 1) : "");
  params.set("embed", "1");
  const s = params.toString();
  return s ? `${path}?${s}` : `${path}?embed=1`;
}
