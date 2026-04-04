/** Dispatched to open Request Help with an optional prefilled message (e.g. lead auto-reply change). */
export const DASHBOARD_OPEN_HELP_REQUEST_EVENT = "dashboard:open-help-request";

export type DashboardOpenHelpRequestDetail = {
  initialMessage: string;
};

export function openDashboardHelpRequest(initialMessage: string): void {
  window.dispatchEvent(
    new CustomEvent<DashboardOpenHelpRequestDetail>(
      DASHBOARD_OPEN_HELP_REQUEST_EVENT,
      { detail: { initialMessage } },
    ),
  );
}
