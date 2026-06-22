import { describe, expect, it } from "vitest";
import {
  buildPatientProgressScans,
  defaultCompareScanPair,
  sortProgressScansChronologically,
} from "./patientProgressScans";
import type { Client } from "../types";

describe("patientProgressScans compare helpers", () => {
  const client = {
    id: "demo",
    name: "Demo",
    progressScans: [
      {
        id: "scan-july",
        label: "July 1, 2026 scan",
        dateIso: "2026-07-01T16:00:00.000Z",
      },
      {
        id: "scan-september",
        label: "September 1, 2026 scan",
        dateIso: "2026-09-01T16:00:00.000Z",
      },
    ],
  } as Client;

  it("defaultCompareScanPair returns the two most recent scans in chronological order", () => {
    const scans = buildPatientProgressScans({ client });
    const pair = defaultCompareScanPair(scans);
    expect(pair).not.toBeNull();
    expect(pair![0].id).toBe("scan-july");
    expect(pair![1].id).toBe("scan-september");
  });

  it("sortProgressScansChronologically orders by date", () => {
    const scans = buildPatientProgressScans({ client });
    const sorted = sortProgressScansChronologically([...scans].reverse());
    expect(sorted.map((scan) => scan.id)).toEqual(["scan-july", "scan-september"]);
  });

  it("defaultCompareScanPair returns null when fewer than two scans exist", () => {
    expect(defaultCompareScanPair([])).toBeNull();
    expect(
      defaultCompareScanPair(
        buildPatientProgressScans({
          client: { ...client, progressScans: [client.progressScans![0]] } as Client,
        }),
      ),
    ).toBeNull();
  });
});
