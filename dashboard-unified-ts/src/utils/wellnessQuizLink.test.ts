import { describe, it, expect, afterEach } from "vitest";
import {
  getWellnessQuizLink,
  getWellnessQuizMessage,
  getWellnessQuizPath,
  parseWellnessQuizParams,
  isWellnessQuizStandalonePath,
} from "./wellnessQuizLink";
import type { Client } from "../types";

describe("wellnessQuizLink", () => {
  const baseClient: Client = {
    id: "rec123",
    tableSource: "Patients",
    name: "Jane",
    email: "jane@example.com",
  } as Client;

  describe("getWellnessQuizPath", () => {
    it("returns /wellness-quiz", () => {
      expect(getWellnessQuizPath()).toBe("/wellness-quiz");
    });
  });

  describe("getWellnessQuizLink", () => {
    it("includes recordId and tableSource in query", () => {
      const link = getWellnessQuizLink(baseClient);
      expect(link).toContain("/wellness-quiz");
      expect(link).toContain("r=rec123");
      expect(link).toContain("t=Patients");
    });
  });

  describe("getWellnessQuizMessage", () => {
    it("returns invite when quiz not complete", () => {
      const msg = getWellnessQuizMessage(baseClient);
      expect(msg).toContain("wellness quiz");
      expect(msg).toContain("rec123");
    });

    it("returns view message when completed", () => {
      const client: Client = {
        ...baseClient,
        wellnessQuiz: {
          version: 1,
          completedAt: "2025-01-01T00:00:00.000Z",
          answers: { age: 0 },
          suggestedTreatmentIds: ["bpc-157"],
        },
      };
      const msg = getWellnessQuizMessage(client);
      expect(msg).toContain("View your wellness quiz");
      expect(msg).toContain("rec123");
    });
  });

  describe("parseWellnessQuizParams", () => {
    const originalSearch = window.location.search;
    const originalPathname = window.location.pathname;

    afterEach(() => {
      window.history.replaceState(null, "", `${originalPathname}${originalSearch}`);
    });

    it("returns recordId and tableName when valid params", () => {
      window.history.replaceState(null, "", "/wellness-quiz?r=rec456&t=Patients");
      expect(parseWellnessQuizParams()).toEqual({ recordId: "rec456", tableName: "Patients" });
    });

    it("returns null when table is not allowed", () => {
      window.history.replaceState(null, "", "/wellness-quiz?r=rec456&t=Other");
      expect(parseWellnessQuizParams()).toBeNull();
    });
  });

  describe("isWellnessQuizStandalonePath", () => {
    const originalPathname = window.location.pathname;

    afterEach(() => {
      window.history.replaceState(null, "", originalPathname);
    });

    it("returns true for /wellness-quiz", () => {
      window.history.replaceState(null, "", "/wellness-quiz");
      expect(isWellnessQuizStandalonePath()).toBe(true);
    });

    it("returns true for /wellness-quiz/", () => {
      window.history.replaceState(null, "", "/wellness-quiz/");
      expect(isWellnessQuizStandalonePath()).toBe(true);
    });

    it("returns false for /", () => {
      window.history.replaceState(null, "", "/");
      expect(isWellnessQuizStandalonePath()).toBe(false);
    });
  });
});
