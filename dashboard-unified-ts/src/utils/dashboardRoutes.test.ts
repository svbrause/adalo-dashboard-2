import { describe, expect, it } from "vitest";
import {
  buildDashboardUrl,
  isDashboardAppPath,
  isDashboardEmbedMode,
  parseDashboardRoute,
  withEmbedSearch,
} from "./dashboardRoutes";

describe("parseDashboardRoute", () => {
  it("parses list paths", () => {
    expect(parseDashboardRoute("/", "")).toEqual({ view: "list" });
    expect(parseDashboardRoute("/patients", "")).toEqual({ view: "list" });
    expect(parseDashboardRoute("/patients", "?page=3")).toEqual({
      view: "list",
      page: 3,
    });
  });

  it("parses other views", () => {
    expect(parseDashboardRoute("/kanban", "")).toEqual({ view: "kanban" });
    expect(parseDashboardRoute("/facial-analysis", "")).toEqual({
      view: "facial-analysis",
    });
  });

  it("parses client detail", () => {
    expect(parseDashboardRoute("/client-details/recABC", "")).toEqual({
      view: "list",
      clientId: "recABC",
    });
  });

  it("parses client detail with view and section", () => {
    expect(
      parseDashboardRoute(
        "/client-details/admin-demo-tanya",
        "?view=facial-analysis&section=mirror",
      ),
    ).toEqual({
      view: "facial-analysis",
      clientId: "admin-demo-tanya",
      section: "mirror",
    });
  });
});

describe("buildDashboardUrl", () => {
  it("round-trips client routes", () => {
    const route = {
      view: "facial-analysis" as const,
      clientId: "admin-demo-tanya",
      section: "mirror" as const,
    };
    const url = buildDashboardUrl(route);
    expect(url).toBe(
      "/client-details/admin-demo-tanya?view=facial-analysis&section=mirror",
    );
    expect(parseDashboardRoute(url.split("?")[0], `?${url.split("?")[1]}`)).toEqual(
      route,
    );
  });

  it("builds view paths", () => {
    expect(buildDashboardUrl({ view: "kanban" })).toBe("/kanban");
    expect(buildDashboardUrl({ view: "list", page: 2 })).toBe("/patients?page=2");
    expect(buildDashboardUrl({ view: "list", page: 1 })).toBe("/patients");
  });
});

describe("isDashboardAppPath", () => {
  it("excludes public routes", () => {
    expect(isDashboardAppPath("/aura")).toBe(false);
    expect(isDashboardAppPath("/tp")).toBe(false);
    expect(isDashboardAppPath("/client-details/x")).toBe(true);
  });
});

describe("embed mode", () => {
  it("detects embed query", () => {
    expect(isDashboardEmbedMode("?embed=1")).toBe(true);
    expect(isDashboardEmbedMode("?embed=true")).toBe(true);
    expect(isDashboardEmbedMode("")).toBe(false);
  });

  it("adds embed param", () => {
    expect(withEmbedSearch("/inbox")).toBe("/inbox?embed=1");
    expect(withEmbedSearch("/client-details/x?section=mirror")).toBe(
      "/client-details/x?section=mirror&embed=1",
    );
  });
});
