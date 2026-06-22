import { describe, expect, it } from "vitest";
import { getSlimStudioSampleClients } from "../debug/slimStudioSampleClients";
import {
  getAnalysisSectionIconKind,
  getAnalysisSectionIconKindFromDisplayLabel,
} from "./dashboardListSectionStatus";
import { formatFacialStatusForDisplay } from "./statusFormatting";
import { SLIM_STUDIO_PROVIDER_CODE } from "../data/slimStudioOfferings";

describe("analysis section icon kind", () => {
  it("maps complete facial analysis status to the check icon", () => {
    expect(getAnalysisSectionIconKindFromDisplayLabel("Complete")).toBe("ready");
    expect(getAnalysisSectionIconKindFromDisplayLabel("Ready for Review")).toBe(
      "ready",
    );
  });

  it("shows Tanya Tan demo with a check when analysis is complete", () => {
    const tanya = getSlimStudioSampleClients()[0];
    expect(tanya?.facialAnalysisStatus).toBe("complete");
    expect(
      formatFacialStatusForDisplay(
        tanya?.facialAnalysisStatus,
        false,
        SLIM_STUDIO_PROVIDER_CODE,
      ),
    ).toBe("Ready for Review");
    expect(getAnalysisSectionIconKind(tanya!, SLIM_STUDIO_PROVIDER_CODE)).toBe(
      "ready",
    );
  });
});
