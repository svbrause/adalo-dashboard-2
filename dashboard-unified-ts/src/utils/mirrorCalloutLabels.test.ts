import { describe, expect, it } from "vitest";
import {
  buildCalloutLabelsForIssues,
  mergeCalloutLabelsByRegion,
  resolveMirrorCalloutLabel,
} from "./mirrorCalloutLabels";

describe("mirrorCalloutLabels", () => {
  it("maps loose neck skin to lower face instead of chin/jawline fallback", () => {
    const labels = buildCalloutLabelsForIssues(["Loose Neck Skin"]);
    expect(labels.rChin).toBe("Loose Neck Skin");
    expect(resolveMirrorCalloutLabel("rChin", labels)).toBe("Loose Neck Skin");
    expect(resolveMirrorCalloutLabel("rChin")).toBe("Lower face");
  });

  it("maps under eye hollow to under-eye regions", () => {
    const labels = buildCalloutLabelsForIssues(["Under Eye Hollow"]);
    expect(
      labels.rLeftUnderEye || labels.rRightUnderEye,
    ).toBe("Under Eye Hollow");
  });

  it("lets finding labels override generic mirror highlight terms", () => {
    const labels = mergeCalloutLabelsByRegion(
      { rLeftUnderEye: "Under Eye" },
      { rLeftUnderEye: "Under Eye Hollow" },
    );
    expect(resolveMirrorCalloutLabel("rLeftUnderEye", labels)).toBe("Under Eye Hollow");
  });

  it("keeps nasolabial issue name on fold regions", () => {
    const labels = buildCalloutLabelsForIssues(["Nasolabial Folds"]);
    expect(
      labels.rLeftNasolabialFold || labels.rRightNasolabialFold,
    ).toBe("Nasolabial Folds");
  });
});
