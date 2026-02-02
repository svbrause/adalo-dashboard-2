// Discussed Treatments Modal – shared types

import type { Client } from "../../../types";

/** Add-entry mode: start by patient goal, assessment finding, or treatment */
export type AddByMode = "goal" | "finding" | "treatment";

export interface DiscussedTreatmentsModalProps {
  client: Client;
  onClose: () => void;
  /** Call after data changes; may return a Promise (e.g. silent refresh). Await before closing so panel shows fresh data. */
  onUpdate: () => void | Promise<void>;
}
