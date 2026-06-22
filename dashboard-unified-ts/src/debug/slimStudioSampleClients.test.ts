import { describe, it, expect } from "vitest";
import {
  SLIM_STUDIO_PROVIDER_CODE,
  SLIM_STUDIO_PROVIDER_RECORD_ID,
} from "../data/slimStudioOfferings";
import {
  getEffectivePriceList,
  matchPlanItemToSku,
} from "../data/treatmentPricing2025";
import { getAlignedCheckoutLineItemsForDiscussedItems } from "../components/modals/DiscussedTreatmentsModal/TreatmentPlanCheckout";
import {
  filterOutSlimStudioSamplesDuplicatedByName,
  getSlimStudioSampleClients,
  getSlimStudioSampleClientsIfEnabled,
  isSlimStudioSampleClientInjectionEnabled,
} from "./slimStudioSampleClients";
import type { Client } from "../types";

describe("filterOutSlimStudioSamplesDuplicatedByName", () => {
  const samples = getSlimStudioSampleClients();
  const dummyLive = (name: string, id: string): Client =>
    ({ id, name, tableSource: "Patients" }) as Client;

  it("removes a demo when a live client has the same name (case/spacing)", () => {
    const live = [dummyLive("  tanya  tan  ", "recA")];
    const out = filterOutSlimStudioSamplesDuplicatedByName(live, samples);
    expect(out.find((c) => c.id === "slimstudio-demo-tanya")).toBeUndefined();
  });

  it("keeps all samples when no name overlap", () => {
    const live = [dummyLive("Someone Else", "recX")];
    expect(filterOutSlimStudioSamplesDuplicatedByName(live, samples)).toEqual(
      samples,
    );
  });

  it("includes the Tanya Tan showcase demo for Slim Studio", () => {
    expect(samples).toHaveLength(1);
    const tanya = samples[0];
    expect(tanya?.name).toBe("Tanya Tan");
    expect(tanya?.severityScoresFromAnalyses?.submission_id).toBe(
      "slimstudio-demo-tanya",
    );
    expect(tanya?.skincareQuiz?.completedAt).toBeTruthy();
    expect(tanya?.demoFacialAnalysisAi).toBeTruthy();
    expect(tanya?.galleryPhotoSlots?.length).toBeGreaterThan(0);
  });

  it("injects demos for Slim Studio provider without requiring dev mode", () => {
    const provider = {
      code: SLIM_STUDIO_PROVIDER_CODE,
      id: SLIM_STUDIO_PROVIDER_RECORD_ID,
      name: "Slim Studio Face & Body",
    };
    expect(isSlimStudioSampleClientInjectionEnabled(provider)).toBe(true);
    const injected = getSlimStudioSampleClientsIfEnabled(provider);
    expect(injected).toHaveLength(1);
    expect(injected[0]?.name).toBe("Tanya Tan");
    expect(injected.every((c) => c.tableSource === "Patients")).toBe(true);
    expect(injected.some((c) => c.email?.includes("@demo.slimstudio.local"))).toBe(
      true,
    );
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
