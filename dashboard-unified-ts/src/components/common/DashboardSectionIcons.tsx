import type { Client } from "../../types";
import {
  analysisSectionAriaLabel,
  getAnalysisSectionIconKind,
  hasQuizCompleted,
  hasTreatmentPlanItems,
} from "../../utils/dashboardListSectionStatus";

/** Minus-circle, clock, check-circle (24×24 viewBox). */
function IconMinusCircle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8 12h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 7v6l4 2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8.5 12.5l2.2 2.2L15.5 10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AnalysisGlyph({ kind }: { kind: ReturnType<typeof getAnalysisSectionIconKind> }) {
  switch (kind) {
    case "not_started":
      return <IconMinusCircle />;
    case "pending":
      return <IconClock />;
    case "ready":
    case "reviewed":
      return <IconCheckCircle />;
    default:
      return <IconClock />;
  }
}

function PlanGlyph({ on }: { on: boolean }) {
  return on ? <IconCheckCircle /> : <IconMinusCircle />;
}

function QuizGlyph({ on }: { on: boolean }) {
  return on ? <IconCheckCircle /> : <IconMinusCircle />;
}

export function DashboardPlanIcon({ client }: { client: Client }) {
  const on = hasTreatmentPlanItems(client);
  return (
    <span
      className={`dashboard-section-icon dashboard-section-icon--plan ${
        on ? "dashboard-section-icon--on" : "dashboard-section-icon--muted"
      }`}
      title={on ? "Plan: has treatment items" : "Plan: not started"}
      aria-label={on ? "Plan: has items" : "Plan: empty"}
      role="img"
    >
      <PlanGlyph on={on} />
    </span>
  );
}

export function DashboardAnalysisIcon({
  client,
  providerCode,
}: {
  client: Client;
  providerCode?: string | null;
}) {
  const kind = getAnalysisSectionIconKind(client, providerCode);
  const label = analysisSectionAriaLabel(client, providerCode);
  const stateClass =
    kind === "not_started"
      ? "dashboard-section-icon--muted"
      : kind === "pending"
        ? "dashboard-section-icon--pending"
        : "dashboard-section-icon--on";

  return (
    <span
      className={`dashboard-section-icon dashboard-section-icon--analysis ${stateClass}`}
      title={label}
      aria-label={label}
      role="img"
    >
      <AnalysisGlyph kind={kind} />
    </span>
  );
}

export function DashboardQuizIcon({ client }: { client: Client }) {
  const on = hasQuizCompleted(client);
  return (
    <span
      className={`dashboard-section-icon dashboard-section-icon--quiz ${
        on ? "dashboard-section-icon--on" : "dashboard-section-icon--muted"
      }`}
      title={on ? "Quiz: completed" : "Quiz: not started"}
      aria-label={on ? "Quiz: completed" : "Quiz: not completed"}
      role="img"
    >
      <QuizGlyph on={on} />
    </span>
  );
}
