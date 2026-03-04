import { describe, it, expect, afterEach } from "vitest";
import {
  getSkinQuizLink,
  getSkinQuizMessage,
  getQuizPath,
  parseSkinQuizParams,
  isSkinQuizStandalonePath,
} from "./skinQuizLink";
import type { Client } from "../types";

describe("skinQuizLink", () => {
  const client: Client = {
    id: "rec123",
    tableSource: "Patients",
    name: "Jane",
    email: "jane@example.com",
  } as Client;

  describe("getQuizPath", () => {
    it("returns /skin-quiz", () => {
      expect(getQuizPath()).toBe("/skin-quiz");
    });
  });

  describe("getSkinQuizLink", () => {
    it("includes recordId and tableSource in query", () => {
      expect(window).toBeDefined();
      const link = getSkinQuizLink(client);
      expect(link).toContain("/skin-quiz");
      expect(link).toContain("r=rec123");
      expect(link).toContain("t=Patients");
    });
  });

  describe("getSkinQuizMessage", () => {
    it("returns message containing the link", () => {
      const msg = getSkinQuizMessage(client);
      expect(msg).toContain("Skin Type Quiz");
      expect(msg).toContain("rec123");
    });
  });

  describe("parseSkinQuizParams", () => {
    const originalSearch = window.location.search;
    const originalPathname = window.location.pathname;

    afterEach(() => {
      window.history.replaceState(null, "", `${originalPathname}${originalSearch}`);
    });

    it("returns recordId and tableName when valid params", () => {
      window.history.replaceState(null, "", "/skin-quiz?r=rec456&t=Patients");
      expect(parseSkinQuizParams()).toEqual({ recordId: "rec456", tableName: "Patients" });
    });

    it("returns null when table is not Patients or Web Popup Leads", () => {
      window.history.replaceState(null, "", "/skin-quiz?r=rec456&t=Other");
      expect(parseSkinQuizParams()).toBeNull();
    });

    it("returns null when r or t missing", () => {
      window.history.replaceState(null, "", "/skin-quiz?r=rec456");
      expect(parseSkinQuizParams()).toBeNull();
      window.history.replaceState(null, "", "/skin-quiz?t=Patients");
      expect(parseSkinQuizParams()).toBeNull();
    });

    it("accepts Web Popup Leads", () => {
      window.history.replaceState(null, "", "/skin-quiz?r=rec789&t=Web%20Popup%20Leads");
      expect(parseSkinQuizParams()).toEqual({
        recordId: "rec789",
        tableName: "Web Popup Leads",
      });
    });
  });

  describe("isSkinQuizStandalonePath", () => {
    const originalPathname = window.location.pathname;

    afterEach(() => {
      window.history.replaceState(null, "", originalPathname);
    });

    it("returns true for /skin-quiz", () => {
      window.history.replaceState(null, "", "/skin-quiz");
      expect(isSkinQuizStandalonePath()).toBe(true);
    });

    it("returns true for /skin-quiz/", () => {
      window.history.replaceState(null, "", "/skin-quiz/");
      expect(isSkinQuizStandalonePath()).toBe(true);
    });

    it("returns false for /", () => {
      window.history.replaceState(null, "", "/");
      expect(isSkinQuizStandalonePath()).toBe(false);
    });

    it("returns false for /dashboard", () => {
      window.history.replaceState(null, "", "/dashboard");
      expect(isSkinQuizStandalonePath()).toBe(false);
    });
  });
});
