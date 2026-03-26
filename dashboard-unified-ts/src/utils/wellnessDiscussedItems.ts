import type { DiscussedItem } from "../types";
import { WELLNESS_TREATMENTS } from "../data/wellnessQuiz";

function compactAlnum(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * True when a plan row looks like a peptide / wellness offering (BPC-157, TB-500, etc.).
 * Matches catalog names and ids only — avoids false positives from generic keywords like "skin".
 */
export function discussedItemMatchesWellnessOffering(item: DiscussedItem): boolean {
  const blob = [item.treatment, item.product, item.interest]
    .filter(Boolean)
    .join(" ");
  if (!blob.trim()) return false;
  const blobC = compactAlnum(blob);
  if (blobC.length < 4) return false;
  return WELLNESS_TREATMENTS.some((wt) => {
    const idC = compactAlnum(wt.id);
    const nameC = compactAlnum(wt.name);
    if (idC.length >= 4 && blobC.includes(idC)) return true;
    if (nameC.length >= 4 && blobC.includes(nameC)) return true;
    return false;
  });
}
