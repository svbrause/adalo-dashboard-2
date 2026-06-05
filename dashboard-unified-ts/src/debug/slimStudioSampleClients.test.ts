import { describe, it, expect } from "vitest";
import {
  SLIM_STUDIO_PLAN_BUILDER_TREATMENTS,
  SLIM_STUDIO_PROVIDER_CODE,
} from "../data/slimStudioOfferings";
import {
  getEffectivePriceList,
  matchPlanItemToSku,
} from "../data/treatmentPricing2025";
import { getAlignedCheckoutLineItemsForDiscussedItems } from "../components/modals/DiscussedTreatmentsModal/TreatmentPlanCheckout";
import {
  filterOutSlimStudioSamplesDuplicatedByName,
  getSlimStudioSampleClients,
} from "./slimStudioSampleClients";
import type { Client } from "../types";

describe("filterOutSlimStudioSamplesDuplicatedByName", () => {
  const samples = getSlimStudioSampleClients();
  const dummyLive = (name: string, id: string): Client =>
    ({ id, name, tableSource: "Patients" }) as Client;

  it("removes a demo when a live client has the same name (case/spacing)", () => {
    const live = [dummyLive("  maya  chen  ", "recA")];
    const out = filterOutSlimStudioSamplesDuplicatedByName(live, samples);
    expect(out.find((c) => c.id === "slimstudio-demo-maya")).toBeUndefined();
    expect(out.find((c) => c.id === "slimstudio-demo-jennifer")).toBeDefined();
  });

  it("keeps all samples when no name overlap", () => {
    const live = [dummyLive("Someone Else", "recX")];
    expect(filterOutSlimStudioSamplesDuplicatedByName(live, samples)).toEqual(
      samples,
    );
  });

  it("includes Admin showcase demos duplicated for Slim Studio", () => {
    const emily = samples.find((c) => c.id === "slimstudio-demo-emily");
    const tanya = samples.find((c) => c.id === "slimstudio-demo-tanya");
    const courtney = samples.find((c) => c.id === "slimstudio-demo-courtney");

    expect(emily?.name).toBe("Emily Dunhill");
    expect(samples.find((c) => c.id === "slimstudio-demo-allison")?.name).toBe(
      "Allison Baum",
    );
    expect(tanya?.name).toBe("Tanya Tan");
    expect(courtney?.name).toBe("Courtney Bellamy");

    expect(emily?.severityScoresFromAnalyses?.submission_id).toBe(
      "slimstudio-demo-emily",
    );
    expect(tanya?.severityScoresFromAnalyses?.submission_id).toBe(
      "slimstudio-demo-tanya",
    );
    expect(tanya?.skincareQuiz?.completedAt).toBeTruthy();
    expect(courtney?.auraManifestUrl).toContain("courtney-bellamy");
    expect(courtney?.severityScoresFromAnalyses?.issues?.["Red Spots"]?.predicted).toBe(
      true,
    );
  });

  it("covers every Slim Studio plan-builder treatment across demo patients", () => {
    const treatments = new Set(
      samples.flatMap((c) => (c.discussedItems ?? []).map((i) => i.treatment)),
    );
    for (const name of SLIM_STUDIO_PLAN_BUILDER_TREATMENTS) {
      expect(treatments.has(name), `missing demo plan item for ${name}`).toBe(true);
    }
  });

  it("resolves a positive price for every demo plan line", () => {
    const priceList = getEffectivePriceList(undefined, SLIM_STUDIO_PROVIDER_CODE);
    for (const client of samples) {
      for (const item of client.discussedItems ?? []) {
        const match = matchPlanItemToSku(item, priceList);
        expect(match, `${client.name} · ${item.treatment} · ${item.product ?? ""}`).not.toBeNull();
        expect(
          match!.totalPrice,
          `${client.name} · ${item.treatment} · ${item.product ?? ""}`,
        ).toBeGreaterThan(0);
      }
      const lines = getAlignedCheckoutLineItemsForDiscussedItems(
        client.discussedItems ?? [],
        priceList,
      );
      expect(lines.length).toBe(client.discussedItems?.length ?? 0);
      for (const line of lines) {
        expect(line.price, line.label).toBeGreaterThan(0);
      }
    }
  });
});
