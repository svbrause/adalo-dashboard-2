import { describe, it, expect } from "vitest";
import { GRAVITAS_PROVIDER_CODE } from "../data/gravitasOfferings";
import {
  getEffectivePriceList,
  matchPlanItemToSku,
} from "../data/treatmentPricing2025";
import { getAlignedCheckoutLineItemsForDiscussedItems } from "../components/modals/DiscussedTreatmentsModal/TreatmentPlanCheckout";
import {
  filterOutGravitasSamplesDuplicatedByName,
  getGravitasSampleClients,
  getGravitasSampleClientsIfEnabled,
  isGravitasSampleClientInjectionEnabled,
} from "./gravitasSampleClients";
import { GRAVITAS_SKINCARE_QUIZ } from "./adminDemoSkincareQuiz";
import type { Client } from "../types";
import { isTanyaTanDemoClient } from "../utils/tanyaTanSystemMedia";
import {
  clientUsesAuraScan,
  getAuraScanVideoUrl,
} from "../utils/auraScanConfig";
import { clientHas3DModel } from "../utils/client3dConfig";

describe("filterOutGravitasSamplesDuplicatedByName", () => {
  const samples = getGravitasSampleClients();
  const dummyLive = (name: string, id: string): Client =>
    ({ id, name, tableSource: "Patients" }) as Client;

  it("removes a demo when a live client has the same name (case/spacing)", () => {
    const live = [dummyLive("  tanya  tan  ", "recA")];
    const out = filterOutGravitasSamplesDuplicatedByName(live, samples);
    expect(out.find((c) => c.id === "gravitas-demo-tanya")).toBeUndefined();
  });

  it("keeps all samples when no name overlap", () => {
    const live = [dummyLive("Someone Else", "recX")];
    expect(filterOutGravitasSamplesDuplicatedByName(live, samples)).toEqual(
      samples,
    );
  });

  it("includes the Tanya Tan showcase demo for Gravitas", () => {
    expect(samples).toHaveLength(1);
    const tanya = samples[0];
    expect(tanya?.name).toBe("Tanya Tan");
    expect(tanya?.severityScoresFromAnalyses?.submission_id).toBe(
      "gravitas-demo-tanya",
    );
    expect(tanya?.skincareQuiz).toEqual(GRAVITAS_SKINCARE_QUIZ);
    expect(tanya?.demoFacialAnalysisAi).toBeTruthy();
    expect(tanya?.galleryPhotoSlots?.length).toBeGreaterThan(0);
    expect(tanya?.discussedItems?.some((i) => i.treatment === "Facials")).toBe(
      true,
    );
    expect(
      tanya?.discussedItems?.some((i) => i.treatment === "Medical Skin Services"),
    ).toBe(true);
    expect(isTanyaTanDemoClient(tanya!)).toBe(true);
    expect(clientUsesAuraScan(tanya!.name)).toBe(true);
    expect(getAuraScanVideoUrl(tanya!.name)).toBeTruthy();
    expect(clientHas3DModel(tanya!.name)).toBe(true);
  });

  it("injects demos for Gravitas272 provider without requiring dev mode", () => {
    const provider = {
      code: GRAVITAS_PROVIDER_CODE,
      name: "Gravitas Medspa",
    };
    expect(isGravitasSampleClientInjectionEnabled(provider)).toBe(true);
    const injected = getGravitasSampleClientsIfEnabled(provider);
    expect(injected).toHaveLength(1);
    expect(injected[0]?.name).toBe("Tanya Tan");
    expect(injected.every((c) => c.tableSource === "Patients")).toBe(true);
    expect(injected.some((c) => c.email?.includes("@demo.gravitas.local"))).toBe(
      true,
    );
  });

  it("skips non-Gravitas providers", () => {
    expect(
      getGravitasSampleClientsIfEnabled({
        code: "TheTreatment250",
        name: "The Treatment",
      }),
    ).toEqual([]);
  });

  it("resolves a positive price for every demo plan line", () => {
    const priceList = getEffectivePriceList(undefined, GRAVITAS_PROVIDER_CODE);
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
