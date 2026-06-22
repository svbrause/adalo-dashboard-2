import type { BackgroundScanSnapshot } from "../../utils/scanJobBackground";
import "./DashboardScanProgress.css";

interface DashboardScanProgressProps {
  snapshot: BackgroundScanSnapshot;
  compact?: boolean;
}

function progressPercent(snapshot: BackgroundScanSnapshot): number {
  if (snapshot.phase === "submitting") return 4;
  if (snapshot.phase === "done") return 100;
  if (snapshot.phase === "running" && snapshot.analysisComplete) return 100;
  return Math.max(4, Math.min(100, Math.round(snapshot.progress * 100)));
}

function formatRemaining(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "<1 min";
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "<1 min" : `${minutes} min`;
}

function statusLabel(snapshot: BackgroundScanSnapshot): string {
  if (snapshot.phase === "submitting") return "Submitting";
  if (snapshot.phase === "running" && snapshot.analysisComplete) {
    return "Analysis ready";
  }
  if (snapshot.phase === "running") return "Processing";
  if (snapshot.phase === "done") return "Ready";
  return "Needs attention";
}

function statusDetail(snapshot: BackgroundScanSnapshot): string {
  if (snapshot.phase === "running") {
    if (snapshot.analysisComplete) {
      if (snapshot.videoUrl || snapshot.assetStatus === "ready") {
        return "3D ready";
      }
      return "3D view building";
    }
    if (snapshot.remaining <= 0) return "taking longer";
    return `about ${formatRemaining(snapshot.remaining)} left`;
  }
  if (snapshot.phase === "submitting") {
    return `up to ${formatRemaining(snapshot.estimatedSeconds)}`;
  }
  if (snapshot.phase === "done") return "Complete";
  return "Retry from client details";
}

export function shouldShowDashboardScanProgress(
  snapshot: BackgroundScanSnapshot | null | undefined,
): snapshot is BackgroundScanSnapshot {
  return (
    snapshot?.phase === "submitting" ||
    snapshot?.phase === "running" ||
    snapshot?.phase === "error"
  );
}

export function isDashboardScanPinned(
  snapshot: BackgroundScanSnapshot | null | undefined,
): snapshot is BackgroundScanSnapshot {
  return shouldShowDashboardScanProgress(snapshot) && !snapshot.analysisComplete;
}

export default function DashboardScanProgress({
  snapshot,
  compact = false,
}: DashboardScanProgressProps) {
  const percent = progressPercent(snapshot);
  const message =
    snapshot.phase === "error"
      ? snapshot.error || snapshot.message
      : snapshot.phase === "running" && snapshot.analysisComplete
        ? snapshot.assetMessage ||
          snapshot.message ||
          "The analysis is complete. The 3D view will appear when ready."
      : "message" in snapshot
        ? snapshot.message || statusLabel(snapshot)
        : statusLabel(snapshot);

  return (
    <div
      className={`dashboard-scan-progress dashboard-scan-progress--${snapshot.phase}${
        compact ? " dashboard-scan-progress--compact" : ""
      }${
        snapshot.phase === "running" && snapshot.analysisComplete
          ? " dashboard-scan-progress--analysis-ready"
          : ""
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="dashboard-scan-progress__topline">
        <span>{statusLabel(snapshot)}</span>
        <span>{statusDetail(snapshot)}</span>
      </div>
      <div className="dashboard-scan-progress__track">
        <div
          className="dashboard-scan-progress__fill"
          style={{ width: `${percent}%` }}
        />
      </div>
      {!compact && (
        <div className="dashboard-scan-progress__message">{message}</div>
      )}
    </div>
  );
}
