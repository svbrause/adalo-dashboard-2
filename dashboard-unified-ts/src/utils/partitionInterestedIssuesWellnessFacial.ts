/**
 * Split `interestedIssues` (intake / lead) into aesthetic-facial vs wellness-oriented.
 * Wellness-like phrases (e.g. brain fog, sleep, recovery) belong with Wellness Quiz, not Facial Analysis.
 */

import { ALL_INTEREST_OPTIONS } from "../components/modals/DiscussedTreatmentsModal/constants";
import { issueToSuggestionMap } from "./issueMapping";
import { WELLNESS_QUIZ, WELLNESS_TREATMENTS } from "../data/wellnessQuiz";
import type { Client } from "../types";

export function parseInterestedIssuesList(client: Client): string[] {
  const raw = client.interestedIssues;
  if (Array.isArray(raw)) return raw.filter((i) => i && String(i).trim());
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((i) => i.trim())
      .filter(Boolean);
  }
  return [];
}

function buildFacialInterestExactSet(): Set<string> {
  const s = new Set<string>();
  for (const o of ALL_INTEREST_OPTIONS) s.add(o.trim().toLowerCase());
  for (const k of Object.keys(issueToSuggestionMap)) {
    s.add(k.trim().toLowerCase());
  }
  for (const v of Object.values(issueToSuggestionMap)) {
    s.add(String(v).trim().toLowerCase());
  }
  return s;
}

let facialExactCache: Set<string> | null = null;
function facialExactLower(): Set<string> {
  if (!facialExactCache) facialExactCache = buildFacialInterestExactSet();
  return facialExactCache;
}

/** True when this intake string aligns with wellness quiz / peptide offerings, not facial aesthetic goals. */
function readsAsWellnessInterest(interest: string): boolean {
  const t = interest.trim().toLowerCase();
  if (t.length < 2) return false;

  if (facialExactLower().has(t)) return false;

  for (const q of WELLNESS_QUIZ.questions) {
    for (const a of q.answers) {
      const L = a.label.toLowerCase();
      if (L.includes(t)) return true;
      for (const seg of L.split(/,|\bor\b/gi)) {
        const s = seg.trim().replace(/^\(?select all[^)]*\)?\s*/i, "").trim();
        if (s.length >= 4 && (t.includes(s) || (t.length >= 6 && s.includes(t)))) {
          return true;
        }
      }
    }
  }

  for (const tr of WELLNESS_TREATMENTS) {
    for (const kw of tr.matchKeywords) {
      const k = kw.toLowerCase();
      /** 3+ chars: matches "gut" in "gut comfort", "gi" stays 2 and is skipped */
      if (k.length >= 3 && t.includes(k)) return true;
    }
  }

  return false;
}

export function partitionInterestedIssuesForFacialVsWellness(
  interests: string[],
): { facialInterests: string[]; wellnessInterests: string[] } {
  const facialInterests: string[] = [];
  const wellnessInterests: string[] = [];
  for (const raw of interests) {
    if (!raw?.trim()) continue;
    (readsAsWellnessInterest(raw) ? wellnessInterests : facialInterests).push(
      raw,
    );
  }
  return { facialInterests, wellnessInterests };
}

/** Deduped list: partitioned wellness phrases from `interestedIssues` plus explicit Airtable "Wellness Goals". */
export function mergeWellnessIntakeFromField(
  partitionedWellness: string[],
  wellnessGoalsField: string[] | undefined,
): string[] {
  const fromField = wellnessGoalsField ?? [];
  if (fromField.length === 0) return partitionedWellness;
  const seen = new Set(
    partitionedWellness.map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  const out = [...partitionedWellness];
  for (const w of fromField) {
    const k = w.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(w.trim());
  }
  return out;
}
