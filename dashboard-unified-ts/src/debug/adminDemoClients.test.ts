import { describe, expect, it } from "vitest";
import {
  ADMIN_DEMO_NAME_COLLISION_SUFFIX,
  getAdminDemoClientsIfEnabled,
} from "./adminDemoClients";
import type { Client } from "../types";

const adminProvider = { code: "admin", name: "Admin" };

function liveClient(overrides: Partial<Client> & Pick<Client, "id" | "name">): Client {
  const { id, name, ...rest } = overrides;
  return {
    email: "live@example.com",
    phone: "",
    tableSource: "Patients",
    archived: false,
    discussedItems: [],
    ...rest,
    id,
    name,
  } as Client;
}

describe("getAdminDemoClientsIfEnabled", () => {
  it("returns Tanya Tan for admin provider", () => {
    const demos = getAdminDemoClientsIfEnabled(adminProvider, []);
    const tanya = demos.find((c) => c.id === "admin-demo-tanya");
    expect(tanya?.name).toBe("Tanya Tan");
  });

  it("includes completed skincare quiz with routine products for Tanya Tan", () => {
    const demos = getAdminDemoClientsIfEnabled(adminProvider, []);
    const tanya = demos.find((c) => c.id === "admin-demo-tanya");
    expect(tanya?.skincareQuiz?.completedAt).toBeTruthy();
    expect(tanya?.skincareQuiz?.result).toBe("amber");
    expect(tanya?.skincareQuiz?.resultLabel).toBe("Amber");
    expect(tanya?.skincareQuiz?.recommendedProductNames?.length).toBeGreaterThan(5);
    expect(Object.keys(tanya?.skincareQuiz?.answers ?? {}).length).toBeGreaterThan(10);
  });

  it("renames demo when a live patient already has the same name", () => {
    const live = [liveClient({ id: "rec-live-tanya", name: "Tanya Tan" })];
    const demos = getAdminDemoClientsIfEnabled(adminProvider, live);
    const tanya = demos.find((c) => c.id === "admin-demo-tanya");
    expect(tanya?.name).toBe(`Tanya Tan${ADMIN_DEMO_NAME_COLLISION_SUFFIX}`);
  });

  it("skips non-admin providers", () => {
    expect(
      getAdminDemoClientsIfEnabled({ code: "TheTreatment250", name: "The Treatment" }, []),
    ).toEqual([]);
  });
});
