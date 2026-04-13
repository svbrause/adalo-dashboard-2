import type { Client } from "../../types";
import "./DashboardSectionIcons.css";
import type { AnalysisSectionIconKind } from "../../utils/dashboardListSectionStatus";
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

function AnalysisGlyph({ kind }: { kind: AnalysisSectionIconKind }) {
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

export function DashboardPlanIcon({
  client,
  embed,
}: {
  client: Client;
  /** Strip circular fill — use inside a colored status pill on client detail. */
  embed?: boolean;
}) {
  const on = hasTreatmentPlanItems(client);
  return (
    <span
      className={`dashboard-section-icon dashboard-section-icon--plan ${
        on ? "dashboard-section-icon--on" : "dashboard-section-icon--muted"
      }${embed ? " dashboard-section-icon--embed" : ""}`}
      title={on ? "Plan: has treatment items" : "Plan: not started"}
      aria-label={on ? "Plan: has items" : "Plan: empty"}
      role="img"
    >
      <PlanGlyph on={on} />
    </span>
  );
}

function analysisIconStateClass(kind: AnalysisSectionIconKind): string {
  if (kind === "not_started") return "dashboard-section-icon--muted";
  if (kind === "pending") return "dashboard-section-icon--pending";
  return "dashboard-section-icon--on";
}

/** Analysis glyph + list-view styling for a known icon kind (e.g. label-derived in detail pills). */
export function DashboardAnalysisIconByKind({
  kind,
  embed,
  title,
  ariaLabel,
}: {
  kind: AnalysisSectionIconKind;
  embed?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  const label = ariaLabel ?? title ?? "Analysis status";
  return (
    <span
      className={`dashboard-section-icon dashboard-section-icon--analysis ${analysisIconStateClass(kind)}${
        embed ? " dashboard-section-icon--embed" : ""
      }`}
      title={title ?? label}
      aria-label={label}
      role="img"
    >
      <AnalysisGlyph kind={kind} />
    </span>
  );
}

export function DashboardAnalysisIcon({
  client,
  providerCode,
  embed,
}: {
  client: Client;
  providerCode?: string | null;
  embed?: boolean;
}) {
  const kind = getAnalysisSectionIconKind(client, providerCode);
  const label = analysisSectionAriaLabel(client, providerCode);
  return (
    <DashboardAnalysisIconByKind
      kind={kind}
      embed={embed}
      title={label}
      aria-label={label}
    />
  );
}

export type DashboardQuizIconScope = "any" | "skincare" | "wellness";

function quizCompletedForScope(
  client: Client,
  scope: DashboardQuizIconScope,
): boolean {
  if (scope === "skincare") return Boolean(client.skincareQuiz?.completedAt);
  if (scope === "wellness") return Boolean(client.wellnessQuiz?.completedAt);
  return hasQuizCompleted(client);
}

export function DashboardQuizIcon({
  client,
  quizScope = "any",
  embed,
}: {
  client: Client;
  /** List view: combined skincare + wellness. Detail sections: one quiz type. */
  quizScope?: DashboardQuizIconScope;
  embed?: boolean;
}) {
  const on = quizCompletedForScope(client, quizScope);
  const title =
    quizScope === "skincare"
      ? on
        ? "Skin quiz: completed"
        : "Skin quiz: not started"
      : quizScope === "wellness"
        ? on
          ? "Wellness quiz: completed"
          : "Wellness quiz: not started"
        : on
          ? "Quiz: completed"
          : "Quiz: not started";
  const ariaLabel =
    quizScope === "skincare"
      ? on
        ? "Skin quiz: completed"
        : "Skin quiz: not completed"
      : quizScope === "wellness"
        ? on
          ? "Wellness quiz: completed"
          : "Wellness quiz: not completed"
        : on
          ? "Quiz: completed"
          : "Quiz: not completed";

  return (
    <span
      className={`dashboard-section-icon dashboard-section-icon--quiz ${
        on ? "dashboard-section-icon--on" : "dashboard-section-icon--muted"
      }${embed ? " dashboard-section-icon--embed" : ""}`}
      title={title}
      aria-label={ariaLabel}
      role="img"
    >
      <QuizGlyph on={on} />
    </span>
  );
}
