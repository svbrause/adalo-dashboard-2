import { useEffect, useRef } from "react";
import type {
  ClinicScanClientMatch,
  ClinicScanContactMatch,
} from "../../utils/clinicScanClientSearch";
import type { ClinicScanCompleteDetail } from "../../utils/clinicScanLink";
import "./ClinicScanModal.css";

export interface ClinicScanInitContext {
  providerId?: string;
  providerName?: string;
  providerCode?: string;
  scanApiBase?: string;
}

export interface ClinicScanModalProps {
  url: string;
  onClose: () => void;
  onComplete?: (detail: ClinicScanCompleteDetail) => void;
  onJobStarted?: (detail: ClinicScanCompleteDetail) => void;
  onSearchClients?: (query: string) => ClinicScanClientMatch[];
  onLookupContact?: (contact: {
    email?: string;
    phone?: string;
  }) => ClinicScanContactMatch[];
  initContext?: ClinicScanInitContext;
}

export default function ClinicScanModal({
  url,
  onClose,
  onComplete,
  onJobStarted,
  onSearchClients,
  onLookupContact,
  initContext,
}: ClinicScanModalProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !initContext) return;

    const sendInit = () => {
      frame.contentWindow?.postMessage(
        {
          type: "clinic-scan-init",
          providerId: initContext.providerId ?? "",
          providerName: initContext.providerName ?? "",
          providerCode: initContext.providerCode ?? "",
          scanApiBase: initContext.scanApiBase ?? "",
        },
        window.location.origin,
      );
    };

    frame.addEventListener("load", sendInit);
    sendInit();
    return () => frame.removeEventListener("load", sendInit);
  }, [initContext, url]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const readDetail = (data: Record<string, unknown>): ClinicScanCompleteDetail => ({
      recordId: String(data.recordId ?? ""),
      tableName: String(data.tableName ?? ""),
      jobId: data.jobId ? String(data.jobId) : undefined,
      estimatedSeconds:
        typeof data.estimatedSeconds === "number"
          ? data.estimatedSeconds
          : undefined,
      clientName: data.clientName ? String(data.clientName) : undefined,
      apiBase: data.apiBase ? String(data.apiBase) : undefined,
      formSubmissionId: data.formSubmissionId
        ? String(data.formSubmissionId)
        : undefined,
      patientCreated:
        typeof data.patientCreated === "boolean" ? data.patientCreated : undefined,
      patientMatchedBy: data.patientMatchedBy
        ? String(data.patientMatchedBy)
        : undefined,
    });

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      const frame = frameRef.current?.contentWindow;
      if (frame && event.source !== frame) return;

      if (data.type === "clinic-scan-job-started") {
        onJobStarted?.(readDetail(data as Record<string, unknown>));
        return;
      }

      if (data.type === "clinic-scan-complete") {
        onComplete?.(readDetail(data as Record<string, unknown>));
        onClose();
        return;
      }

      if (!frame) return;

      if (data.type === "clinic-scan-search-clients") {
        const requestId = String(data.requestId ?? "");
        const query = String(data.query ?? "");
        const results = onSearchClients?.(query) ?? [];
        frame.postMessage(
          { type: "clinic-scan-search-results", requestId, results },
          window.location.origin,
        );
        return;
      }

      if (data.type === "clinic-scan-lookup-contact") {
        const requestId = String(data.requestId ?? "");
        const email = String(data.email ?? "");
        const phone = String(data.phone ?? "");
        const results =
          onLookupContact?.({
            email: email || undefined,
            phone: phone || undefined,
          }) ?? [];
        frame.postMessage(
          { type: "clinic-scan-lookup-contact-results", requestId, results },
          window.location.origin,
        );
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onClose, onComplete, onJobStarted, onLookupContact, onSearchClients]);

  return (
    <div
      className="clinic-scan-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="In-clinic face scan"
    >
      <div className="clinic-scan-modal-shell">
        <button
          type="button"
          className="clinic-scan-modal-close"
          onClick={onClose}
          aria-label="Close scan"
        >
          ×
        </button>
        <iframe
          ref={frameRef}
          className="clinic-scan-modal-frame"
          src={url}
          title="In-clinic face scan"
          allow="camera; microphone; fullscreen"
        />
      </div>
    </div>
  );
}
