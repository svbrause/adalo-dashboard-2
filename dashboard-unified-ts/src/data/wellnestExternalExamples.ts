/**
 * Curated third-party links for peptide education & social context.
 * Updated manually from public reporting — not live-scraped (CORS / ToS / rate limits).
 * Wellnest MD does not endorse linked creators, outlets, or forums.
 */

import type { WellnestOffering } from "./wellnestOfferings";

export type WellnestExternalExampleKind =
  | "news"
  | "youtube"
  | "reddit"
  | "podcast"
  | "government"
  | "research"
  | "investigation";

export type WellnestExternalExample = {
  id: string;
  title: string;
  url: string;
  kind: WellnestExternalExampleKind;
  /** Short caveat shown under the link */
  note?: string;
};

/** Trend reporting, expert commentary, and community hubs (shown for every peptide modal). */
export const WELLNEST_EXTERNAL_CONTEXT_LINKS: WellnestExternalExample[] = [
  {
    id: "time-peptides-social",
    title:
      "TIME — What to know about ‘anti-aging’ peptide shots on social media",
    url: "https://time.com/7380810/anti-aging-peptide-shots-social-media/",
    kind: "news",
    note: "Covers TikTok, Instagram, Reddit buzz, gray-market sourcing, and evidence gaps.",
  },
  {
    id: "huberman-peptides-podcast",
    title: "Huberman Lab — Peptide & hormone therapies (long-form interview)",
    url: "https://www.hubermanlab.com/episode/dr-craig-koniver-peptide-hormone-therapies-for-health-performance-longevity",
    kind: "podcast",
    note: "Popular science podcast; not a substitute for your clinic’s protocol.",
  },
  {
    id: "reddit-peptides",
    title: "Reddit — r/Peptides (community discussion)",
    url: "https://www.reddit.com/r/Peptides/",
    kind: "reddit",
    note: "Anonymous user reports; verify nothing here as medical fact.",
  },
  {
    id: "fda-compounding-peptides",
    title: "FDA — Safety risks of certain compounded peptide substances",
    url: "https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks",
    kind: "government",
  },
  {
    id: "propublica-peptide-event",
    title: "ProPublica — Reporting on peptide injections at a public event",
    url: "https://www.propublica.org/article/peptide-injections-raadfest-rfk-jr",
    kind: "investigation",
    note: "Investigative context on harms and promotion.",
  },
];

/** YouTube samples keyed by wellnessQuizId (aligned with skin-type-react / wellnestOfferings). */
const WELLNESS_QUIZ_ID_YOUTUBE: Partial<
  Record<string, WellnestExternalExample[]>
> = {
  "bpc-157": [
    {
      id: "yt-bpc157-overview",
      title: "YouTube — Creator overview of BPC-157 claims vs. published research",
      url: "https://www.youtube.com/watch?v=gaQwrB8HW4o",
      kind: "youtube",
      note: "Third-party explainer; not affiliated with Wellnest MD.",
    },
  ],
  "tb-500": [
    {
      id: "yt-tb500-overview",
      title: "YouTube — Third-party overview of TB-500 / thymosin beta-4 narratives",
      url: "https://www.youtube.com/watch?v=OffXGrrzI3A",
      kind: "youtube",
      note: "Creator content; not affiliated with Wellnest MD.",
    },
  ],
};

function pubmedSearchExample(
  query: string,
  idSuffix: string,
): WellnestExternalExample {
  return {
    id: `pubmed-${idSuffix}`,
    title: `PubMed — Search: ${query}`,
    url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`,
    kind: "research",
    note: "Literature index; many hits are animal or lab studies, not clinical care guidelines.",
  };
}

function dedupeByUrl(items: WellnestExternalExample[]): WellnestExternalExample[] {
  const seen = new Set<string>();
  return items.filter((x) => {
    const u = x.url.trim();
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}

/**
 * Links to show in the Wellnest “Overview & examples” modal.
 * Mixes fixed “social trend” context with PubMed + optional YouTube for this peptide.
 */
export function getWellnestExternalExamplesForOffering(
  offering: WellnestOffering,
): WellnestExternalExample[] {
  const specific: WellnestExternalExample[] = [];

  const quizId = offering.wellnessQuizId;
  if (quizId && WELLNESS_QUIZ_ID_YOUTUBE[quizId]?.length) {
    specific.push(...WELLNESS_QUIZ_ID_YOUTUBE[quizId]!);
  }

  const name = offering.treatmentName.trim();
  const idSlug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "peptide";
  specific.push(pubmedSearchExample(`${name} peptide`, idSlug));

  const merged = [...WELLNEST_EXTERNAL_CONTEXT_LINKS, ...specific];
  return dedupeByUrl(merged);
}

export const WELLNEST_EXTERNAL_LINKS_DISCLAIMER =
  "Links are independent third parties (news, creators, forums, government, research indexes). They are for staff education and patient conversation starters only — not endorsements, not medical advice, and not vetted for accuracy.";
