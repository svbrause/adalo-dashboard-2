import type { DiscussedItem } from "../types";
import type { CheckoutLineItemDetail } from "../data/treatmentPricing2025";
import {
  PVB_PLAN_TERM_GLOSSARY,
  buildPlanGlossaryContext,
} from "../config/pvbPlanTermGlossary";

export type PvbResolvedPlanGlossaryTerm = {
  id: string;
  /** Normalized chapter keys where this card is shown */
  chapterKeys: string[];
  title: string;
  body: string;
  /** Extra line when we can tie the term to plan context */
  relationToYou: string | null;
};

export function filterGlossaryTermsForChapter(
  terms: PvbResolvedPlanGlossaryTerm[],
  chapterKey: string,
): PvbResolvedPlanGlossaryTerm[] {
  const k = chapterKey.trim().toLowerCase();
  return terms.filter((t) => t.chapterKeys.includes(k));
}

function collectPlanCorpus(
  items: DiscussedItem[],
  lineItems: CheckoutLineItemDetail[],
): string {
  const parts: string[] = [];
  for (const d of items) {
    for (const x of [
      d.treatment,
      d.product,
      d.region,
      d.timeline,
      d.quantity,
      d.notes,
      d.interest,
      ...(d.findings ?? []),
    ]) {
      if (x) parts.push(x);
    }
  }
  for (const line of lineItems) {
    for (const x of [
      line.label,
      line.skuName,
      line.displayPrice,
      line.skuNote,
      line.description,
    ]) {
      if (x) parts.push(x);
    }
  }
  return parts.join("\n");
}

/**
 * Surfaces glossary entries when abbreviations or modalities appear in the plan, quote SKUs,
 * or optional overview narrative text.
 */
export function getResolvedPlanGlossaryTerms(
  discussedItems: DiscussedItem[],
  quoteLineItems: CheckoutLineItemDetail[],
  overviewTexts: string[],
): PvbResolvedPlanGlossaryTerm[] {
  const ctx = buildPlanGlossaryContext(discussedItems);
  const corpus = [collectPlanCorpus(discussedItems, quoteLineItems), ...overviewTexts]
    .filter(Boolean)
    .join("\n\n");

  if (!corpus.trim()) return [];

  const seen = new Set<string>();
  const out: PvbResolvedPlanGlossaryTerm[] = [];

  for (const def of PVB_PLAN_TERM_GLOSSARY) {
    const hit = def.match.some((re) => {
      re.lastIndex = 0;
      return re.test(corpus);
    });
    if (!hit) continue;
    if (seen.has(def.id)) continue;
    seen.add(def.id);
    const relation = def.relationToYou?.(ctx) ?? null;
    out.push({
      id: def.id,
      chapterKeys: [...def.chapterKeys],
      title: def.title,
      body: def.body,
      relationToYou: relation,
    });
  }

  return out;
}
