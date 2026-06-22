import { describe, it, expect } from "vitest";
import { PRETTY_PLEASE_PROVIDER_CODE } from "../data/prettyPleaseOfferings";
import {
  getEffectivePriceList,
  matchPlanItemToSku,
} from "../data/treatmentPricing2025";
import { getAlignedCheckoutLineItemsForDiscussedItems } from "../components/modals/DiscussedTreatmentsModal/TreatmentPlanCheckout";
import {
  filterOutPrettyPleaseSamplesDuplicatedByName,
  getPrettyPleaseSampleClients,
  getPrettyPleaseSampleClientsIfEnabled,
  isPrettyPleaseSampleClientInjectionEnabled,
} from "./prettyPleaseSampleClients";
import { PRETTY_PLEASE_SKINCARE_QUIZ } from "./adminDemoSkincareQuiz";
import type { Client } from "../types";

describe("filterOutPrettyPleaseSamplesDuplicatedByName", () => {
  const samples = getPrettyPleaseSampleClients();
  const dummyLive = (name: string, id: string): Client =>
    ({ id, name, tableSource: "Patients" }) as Client;

  it("removes a demo when a live client has the same name (case/spacing)", () => {
    const live = [dummyLive("  tanya  tan  ", "recA")];
    const out = filterOutPrettyPleaseSamplesDuplicatedByName(live, samples);
    expect(out.find((c) => c.id === "prettyplease-demo-tanya")).toBeUndefined();
  });

  it("keeps all samples when no name overlap", () => {
    const live = [dummyLive("Someone Else", "recX")];
    expect(filterOutPrettyPleaseSamplesDuplicatedByName(live, samples)).toEqual(
      samples,
    );
  });

  it("includes the Tanya Tan showcase demo for Pretty Please", () => {
    expect(samples).toHaveLength(1);
    const tanya = samples[0];
    expect(tanya?.name).toBe("Tanya Tan");
    expect(tanya?.severityScoresFromAnalyses?.submission_id).toBe(
      "prettyplease-demo-tanya",
    );
    expect(tanya?.skincareQuiz).toEqual(PRETTY_PLEASE_SKINCARE_QUIZ);
    expect(tanya?.demoFacialAnalysisAi).toBeTruthy();
    expect(tanya?.galleryPhotoSlots?.length).toBeGreaterThan(0);
    expect(tanya?.discussedItems?.some((i) => i.treatment === "Vi Peels")).toBe(
      true,
    );
    expect(tanya?.discussedItems?.some((i) => i.treatment === "Facials")).toBe(
      true,
    );
  });

  it("injects demos for PrettyPlease5357 provider without requiring dev mode", () => {
    const provider = {
      code: PRETTY_PLEASE_PROVIDER_CODE,
      name: "Pretty Please Aesthetics",
    };
    expect(isPrettyPleaseSampleClientInjectionEnabled(provider)).toBe(true);
    const injected = getPrettyPleaseSampleClientsIfEnabled(provider);
    expect(injected).toHaveLength(1);
    expect(injected[0]?.name).toBe("Tanya Tan");
    expect(injected.every((c) => c.tableSource === "Patients")).toBe(true);
    expect(
      injected.some((c) => c.email?.includes("@demo.prettyplease.local")),
    ).toBe(true);
  });

  it("skips non-Pretty Please providers", () => {
    expect(
      getPrettyPleaseSampleClientsIfEnabled({
        code: "TheTreatment250",
        name: "The Treatment",
      }),
    ).toEqual([]);
  });

  it("resolves a positive price for every demo plan line", () => {
    const priceList = getEffectivePriceList(undefined, PRETTY_PLEASE_PROVIDER_CODE);
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
