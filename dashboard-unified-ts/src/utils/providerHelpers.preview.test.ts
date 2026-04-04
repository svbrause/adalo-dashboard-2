import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Provider } from "../types";
import {
  isPostVisitBlueprintProviderCode,
  isPostVisitBlueprintSender,
  providerShowsTheTreatmentPreviewUi,
} from "./providerHelpers";

describe("The Treatment preview feature gate", () => {
  const treatmentProvider = {
    id: "p1",
    name: "The Treatment",
    code: "TheTreatment250",
  } as Provider;

  const adminProvider = {
    id: "p2",
    name: "Admin",
    code: "password",
  } as Provider;

  beforeEach(() => {
    vi.stubEnv("VITE_THE_TREATMENT_PREVIEW_FEATURES", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows Post-Visit Blueprint sender for The Treatment without preview env", () => {
    expect(isPostVisitBlueprintSender(treatmentProvider)).toBe(true);
  });

  it("allows Post-Visit Blueprint sender for The Treatment when preview env is true", () => {
    vi.stubEnv("VITE_THE_TREATMENT_PREVIEW_FEATURES", "true");
    expect(isPostVisitBlueprintSender(treatmentProvider)).toBe(true);
  });

  it("never gates admin blueprint provider on preview env", () => {
    expect(isPostVisitBlueprintSender(adminProvider)).toBe(true);
  });

  it("providerShowsTheTreatmentPreviewUi is true for Treatment when preview off", () => {
    expect(providerShowsTheTreatmentPreviewUi(treatmentProvider)).toBe(true);
  });

  it("providerShowsTheTreatmentPreviewUi is true for Treatment when preview on", () => {
    vi.stubEnv("VITE_THE_TREATMENT_PREVIEW_FEATURES", "true");
    expect(providerShowsTheTreatmentPreviewUi(treatmentProvider)).toBe(true);
  });

  it("providerShowsTheTreatmentPreviewUi stays true for non-Treatment providers", () => {
    const other = {
      id: "p3",
      name: "Other Clinic",
      code: "SomeOtherCode",
    } as Provider;
    expect(providerShowsTheTreatmentPreviewUi(other)).toBe(true);
  });

  it("providerShowsTheTreatmentPreviewUi is true when provider is missing", () => {
    expect(providerShowsTheTreatmentPreviewUi(null)).toBe(true);
  });

  it("allows Post-Visit Blueprint sender for any logged-in provider", () => {
    const other = {
      id: "p3",
      name: "Other Clinic",
      code: "SomeOtherCode",
    } as Provider;
    expect(isPostVisitBlueprintSender(other)).toBe(true);
  });

  it("does not allow Post-Visit Blueprint sender when provider is missing", () => {
    expect(isPostVisitBlueprintSender(null)).toBe(false);
  });

  it("accepts any non-empty provider code on blueprint payloads", () => {
    expect(isPostVisitBlueprintProviderCode("SomeClinic99")).toBe(true);
    expect(isPostVisitBlueprintProviderCode("TheTreatment250")).toBe(true);
    expect(isPostVisitBlueprintProviderCode("")).toBe(false);
    expect(isPostVisitBlueprintProviderCode(null)).toBe(false);
  });
});
