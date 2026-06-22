import { describe, expect, it } from "vitest";
import type { Client } from "../types";
import {
  buildClinicScanUrl,
  buildLegacyJotformScanUrl,
  useExternalClinicScanForm,
} from "./clinicScanLink";

const client = {
  id: "rec123",
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "+1 (555) 555-0100",
  tableSource: "Web Popup Leads",
  dateOfBirth: "1990-05-15",
  areas: ["Eyes", "Cheeks"],
  concerns: "wrinkles",
} as Client;

describe("clinicScanLink", () => {
  it("builds embedded clinic scan URL with client context", () => {
    const url = buildClinicScanUrl(client, null);
    expect(url).toContain("/clinic-scan/index.html?");
    expect(url).toContain("r=rec123");
    expect(url).toContain("firstName=Jane");
    expect(url).toContain("lastName=Doe");
    expect(url).toContain("email=jane%40example.com");
    expect(url).toContain("dob=1990-05-15");
  });

  it("builds legacy jotform URL when external mode is used", () => {
    expect(useExternalClinicScanForm()).toBe(false);
    const url = buildLegacyJotformScanUrl(client, null);
    expect(url).toContain("name[first]=Jane");
    expect(url).toContain("email=jane%40example.com");
  });
});
