import { describe, it, expect } from "vitest";
import {
  buildSmsSendErrorMessage,
  OPENPHONE_INVALID_TO_CODE,
} from "./smsSendErrorMessage";

describe("buildSmsSendErrorMessage", () => {
  it("returns consolidated copy for OpenPhone code 0202400 (no duplicate OpenPhone + hint)", () => {
    const msg = buildSmsSendErrorMessage({
      error: "OpenPhone API error",
      details: {
        message: "At least one of the phone numbers in the `to` array is invalid",
        code: OPENPHONE_INVALID_TO_CODE,
        status: 400,
      },
    });
    expect(msg).toBe(
      "OpenPhone rejected this recipient as invalid or not SMS-deliverable. Use a real US mobile number you can receive texts on.",
    );
    expect(msg).not.toContain("At least one of the phone numbers");
  });

  it("detects invalid to from message text when code missing", () => {
    expect(
      buildSmsSendErrorMessage({
        details: {
          message: "At least one of the phone numbers in the `to` array is invalid",
        },
      }),
    ).toBe(
      "OpenPhone rejected this recipient as invalid or not SMS-deliverable. Use a real US mobile number you can receive texts on.",
    );
  });

  it("passes through other OpenPhone/backend messages unchanged", () => {
    expect(
      buildSmsSendErrorMessage({
        details: { message: "Not enough credits", code: "0200402" },
      }),
    ).toBe("Not enough credits");
    expect(
      buildSmsSendErrorMessage({ message: "Network timeout from proxy" }),
    ).toBe("Network timeout from proxy");
  });

  it("falls back when body is empty", () => {
    expect(buildSmsSendErrorMessage({})).toBe(
      "Failed to send SMS notification",
    );
    expect(buildSmsSendErrorMessage(null)).toBe(
      "Failed to send SMS notification",
    );
  });
});
