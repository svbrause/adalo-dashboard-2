import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboard } from "../../context/DashboardContext";
import {
  clientToClinicScanMatch,
  findClientsByContactForClinicScan,
  searchClientsForClinicScan,
} from "../../utils/clinicScanClientSearch";
import { createOptimisticClinicScanClient } from "../../utils/clinicScanOptimisticClient";
import {
  registerClinicScanOpener,
  type ClinicScanCompleteDetail,
} from "../../utils/clinicScanLink";
import { showToast } from "../../utils/toast";
import { getClinicScanSubmitApiBase } from "../../utils/scanApi";
import { trackSubmittedBackgroundScanJob } from "../../utils/scanJobBackground";
import ClinicScanModal from "./ClinicScanModal";

export default function ClinicScanHost() {
  const {
    clients,
    provider,
    refreshClients,
    setClients,
    setCurrentView,
    pagination,
    setPagination,
  } = useDashboard();
  const [scanUrl, setScanUrl] = useState<string | null>(null);
  const announcedJobKeys = useRef(new Set<string>());

  const closeScan = useCallback(() => setScanUrl(null), []);

  const handleSearchClients = useCallback(
    (query: string) =>
      searchClientsForClinicScan(clients, query).map(clientToClinicScanMatch),
    [clients],
  );

  const handleLookupContact = useCallback(
    (contact: { email?: string; phone?: string }) =>
      findClientsByContactForClinicScan(clients, contact),
    [clients],
  );

  useEffect(() => {
    return registerClinicScanOpener((url) => setScanUrl(url));
  }, []);

  const handleJobStarted = useCallback(
    async (detail: ClinicScanCompleteDetail) => {
      if (!detail.recordId) return;

      if (detail.jobId) {
        trackSubmittedBackgroundScanJob({
          recordId: detail.recordId,
          tableName: detail.tableName || "Patients",
          clientName: detail.clientName,
          jobId: detail.jobId,
          estimatedSeconds: detail.estimatedSeconds,
          apiBase: detail.apiBase || getClinicScanSubmitApiBase(),
          providerId: provider?.id,
          formSubmissionId: detail.formSubmissionId,
          quality: "standard",
        });
      }

      setCurrentView("list");
      setPagination({ ...pagination, currentPage: 1 });
      setClients((prevClients) => {
        if (prevClients.some((client) => client.id === detail.recordId)) {
          return prevClients;
        }
        return [createOptimisticClinicScanClient(detail), ...prevClients];
      });

      const jobKey =
        detail.jobId || detail.formSubmissionId || `${detail.recordId}:clinic-scan`;
      if (!announcedJobKeys.current.has(jobKey)) {
        announcedJobKeys.current.add(jobKey);
        showToast("Capture saved. Analysis is processing on the dashboard.");
      }

      await refreshClients(true);
      window.setTimeout(() => {
        void refreshClients(true);
      }, 2500);
    },
    [
      pagination,
      provider?.id,
      refreshClients,
      setClients,
      setCurrentView,
      setPagination,
    ],
  );

  const handleComplete = useCallback(
    async (detail: ClinicScanCompleteDetail) => {
      if (detail.recordId) {
        await refreshClients(true);
      }
    },
    [refreshClients],
  );

  if (!scanUrl) return null;

  return (
    <ClinicScanModal
      url={scanUrl}
      onClose={closeScan}
      onComplete={handleComplete}
      onJobStarted={handleJobStarted}
      onSearchClients={handleSearchClients}
      onLookupContact={handleLookupContact}
      initContext={{
        providerId: provider?.id,
        providerName: provider?.name,
        providerCode: provider?.code,
        scanApiBase: getClinicScanSubmitApiBase(),
      }}
    />
  );
}
