import type { Client } from "../../types";
import {
  formatFacialStatusForDisplay,
  getFacialStatusColorForDisplay,
  hasFacialInterestedTreatments,
} from "../../utils/statusFormatting";
import { WEB_POPUP_LEAD_NO_ANALYSIS_STATUS } from "../../utils/clientMapper";
import type { AnalysisSectionIconKind } from "../../utils/dashboardListSectionStatus";
import {
  getAnalysisSectionIconKindFromDisplayLabel,
  hasTreatmentPlanItems,
} from "../../utils/dashboardListSectionStatus";
import {
  DashboardAnalysisIconByKind,
  DashboardPlanIcon,
  DashboardQuizIcon,
  type DashboardQuizIconScope,
} from "./DashboardSectionIcons";
import "./DetailSectionStatusPill.css";

function facialToneClass(kind: AnalysisSectionIconKind): string {
  if (kind === "not_started") return "detail-section-status-pill--tone-muted";
  if (kind === "pending") return "detail-section-status-pill--tone-pending";
  if (kind === "ready") return "detail-section-status-pill--tone-ready";
  return "detail-section-status-pill--tone-reviewed";
}

export function FacialAnalysisStatusPill({
  client,
  providerCode,
  facialAnalysisFormHasData,
}: {
  client: Client;
  providerCode?: string | null;
  facialAnalysisFormHasData: boolean;
}) {
  const raw = client.facialAnalysisStatus?.trim();
  let statusForDisplay =
    raw ||
    (client.tableSource === "Web Popup Leads"
      ? WEB_POPUP_LEAD_NO_ANALYSIS_STATUS
      : "not-started");
  if (!facialAnalysisFormHasData) {
    const low = (raw ?? "").toLowerCase();
    if (!low || low === "pending") {
      statusForDisplay = "not-started";
    }
  }
  const label = formatFacialStatusForDisplay(
    statusForDisplay,
    hasFacialInterestedTreatments(client),
    providerCode,
  );
  const bg = getFacialStatusColorForDisplay(
    statusForDisplay,
    hasFacialInterestedTreatments(client),
    providerCode,
  );
  const kind = getAnalysisSectionIconKindFromDisplayLabel(label);
  const aria = `Analysis: ${label}`;

  return (
    <div
      className={`detail-section-status-pill detail-section-status-pill--facial ${facialToneClass(kind)}`}
      style={{ backgroundColor: bg }}
      title={label}
    >
      <DashboardAnalysisIconByKind
        kind={kind}
        embed
        title={label}
        ariaLabel={aria}
      />
      <span className="detail-section-status-pill-label">{label}</span>
    </div>
  );
}

export function PlanStatusPill({ client }: { client: Client }) {
  const complete = hasTreatmentPlanItems(client);
  return (
    <div
      className={`detail-section-status-pill${
        complete
          ? " detail-section-status-pill--positive"
          : " detail-section-status-pill--muted"
      }`}
      title={complete ? "Treatment plan has items" : "No items in plan yet"}
    >
      <DashboardPlanIcon client={client} embed />
      <span className="detail-section-status-pill-label">
        {complete ? "Built" : "Not started"}
      </span>
    </div>
  );
}

export function QuizStatusPill({
  client,
  quizScope,
}: {
  client: Client;
  quizScope: Exclude<DashboardQuizIconScope, "any">;
}) {
  const on =
    quizScope === "skincare"
      ? Boolean(client.skincareQuiz?.completedAt)
      : Boolean(client.wellnessQuiz?.completedAt);
  return (
    <div
      className={`detail-section-status-pill${
        on
          ? " detail-section-status-pill--positive"
          : " detail-section-status-pill--muted"
      }`}
      title={
        on
          ? quizScope === "skincare"
            ? "Skin quiz completed"
            : "Wellness quiz completed"
          : quizScope === "skincare"
            ? "Skin quiz not started"
            : "Wellness quiz not started"
      }
    >
      <DashboardQuizIcon client={client} quizScope={quizScope} embed />
      <span className="detail-section-status-pill-label">
        {on ? "Completed" : "Not started"}
      </span>
    </div>
  );
}
