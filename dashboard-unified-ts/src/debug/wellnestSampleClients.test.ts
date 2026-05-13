import { describe, it, expect } from "vitest";
import {
  filterOutWellnestSamplesDuplicatedByName,
  getWellnestSampleClients,
} from "./wellnestSampleClients";
import type { Client } from "../types";

describe("filterOutWellnestSamplesDuplicatedByName", () => {
  const samples = getWellnestSampleClients();
  const dummyLive = (name: string, id: string): Client =>
    ({ id, name, tableSource: "Patients" } as Client);

  it("removes a demo when a live client has the same name (case/spacing)",
    () => {
      const live = [dummyLive("  alex  rivera  ", "recA")];
      const out = filterOutWellnestSamplesDuplicatedByName(live, samples);
      expect(out.find((c) => c.id === "wellnest-demo-alex")).toBeUndefined();
      expect(out.find((c) => c.id === "wellnest-demo-jordan")).toBeDefined();
    });

  it("keeps all samples when no name overlap", () => {
    const live = [dummyLive("Someone Else", "recX")];
    expect(filterOutWellnestSamplesDuplicatedByName(live, samples)).toEqual(
      samples,
    );
  });
});
