import { describe, expect, it } from "vitest";
import { matchPlanItemToSku } from "./treatmentPricing2025";

describe("matchPlanItemToSku — Energy Treatment", () => {
  it("prices Moxi Face, Neck & Chest at $995 (not Moxi Full Face $550)", () => {
    const match = matchPlanItemToSku({
      treatment: "Energy Treatment",
      product: "Moxi",
      region: "Face, Neck & Chest",
    });
    expect(match?.sku.name).toBe("Moxi Face, Neck & Chest");
    expect(match?.totalPrice).toBe(995);
  });

  it("prices Moxi Full Face at $550", () => {
    const match = matchPlanItemToSku({
      treatment: "Energy Treatment",
      product: "Moxi",
      region: "Full Face",
    });
    expect(match?.sku.name).toBe("Moxi Full Face");
    expect(match?.totalPrice).toBe(550);
  });

  it("prices BBL Face, Neck & Chest at $995", () => {
    const match = matchPlanItemToSku({
      treatment: "Energy Treatment",
      product: "BBL (BroadBand Light)",
      region: "Face, Neck & Chest",
    });
    expect(match?.sku.name).toBe("BBL Face, Neck & Chest");
    expect(match?.totalPrice).toBe(995);
  });

  it("prices BBL + Moxi Face, Neck & Chest at $1150", () => {
    const match = matchPlanItemToSku({
      treatment: "Energy Treatment",
      product: "Moxi + BBL",
      region: "Face, Neck & Chest",
    });
    expect(match?.sku.name).toBe("BBL + Moxi Face, Neck & Chest");
    expect(match?.totalPrice).toBe(1150);
  });

  it("prices Sofwave Full Face + Neck at $3900", () => {
    const match = matchPlanItemToSku({
      treatment: "Energy Treatment",
      product: "Sofwave",
      region: "Full Face + Neck",
    });
    expect(match?.sku.name).toBe("Sofwave – Full Face + Neck");
    expect(match?.totalPrice).toBe(3900);
  });
});

describe("matchPlanItemToSku — Chemical Peel", () => {
  it("prices Jessner Face, Neck & Chest at $360 (not Full Face $180)", () => {
    const match = matchPlanItemToSku({
      treatment: "Chemical Peel",
      product: "Jessner's Peel",
      region: "Face, Neck & Chest",
    });
    expect(match?.sku.name).toBe("Jessner's Peel – Face, Neck & Chest");
    expect(match?.totalPrice).toBe(360);
  });
});
