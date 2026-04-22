import { useEffect } from "react";
import type { Client } from "../types";
import { isAddClientLead } from "../utils/leadSource";
import { capturePatientAcquisitionFunnelEvent } from "../utils/patientAcquisitionAnalytics";

/**
 * Fires once per lead (localStorage) when an "Add Client" Web Popup Lead gets facial analysis form data.
 */
export function useAddClientAcquisitionFunnelScan(
  client: Client | null | undefined,
  facialAnalysisFormHasData: boolean,
): void {
  useEffect(() => {
    if (!client?.id || !facialAnalysisFormHasData || !isAddClientLead(client)) {
      return;
    }
    const key = `ph_acq_scanned:${client.id}`;
    try {
      if (typeof localStorage === "undefined") return;
      if (localStorage.getItem(key) === "1") return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    capturePatientAcquisitionFunnelEvent("funnel_patient_scanned", client.id, {
      table_source: client.tableSource,
    });
  }, [client, facialAnalysisFormHasData]);
}
