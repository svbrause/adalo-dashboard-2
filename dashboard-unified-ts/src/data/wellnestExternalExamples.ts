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

/** Generic context links still shown for broad safety context. */
export const WELLNEST_EXTERNAL_CONTEXT_LINKS: WellnestExternalExample[] = [
  {
    id: "fda-compounding-peptides",
    title: "FDA — Safety risks of certain compounded peptide substances",
    url: "https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks",
    kind: "government",
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
  semax: [
    {
      id: "yt-semax-vs-selank",
      title: "YouTube — Semax vs Selank (focus vs anxiety overview)",
      url: "https://www.youtube.com/watch?v=PpFDqoI7zGY",
      kind: "youtube",
      note: "Creator content; independent and not affiliated with Wellnest MD.",
    },
    {
      id: "yt-semax-faq",
      title: "YouTube — Semax review and FAQ",
      url: "https://www.youtube.com/watch?v=G08bBXbxuPI",
      kind: "youtube",
      note: "Third-party explainer; verify claims clinically.",
    },
  ],
  selank: [
    {
      id: "yt-selank-vs-semax",
      title: "YouTube — Semax vs Selank (focus vs anxiety overview)",
      url: "https://www.youtube.com/watch?v=PpFDqoI7zGY",
      kind: "youtube",
      note: "Creator content; independent and not affiliated with Wellnest MD.",
    },
  ],
};

/** Treatment-specific direct links (preferred over generic search result pages). */
const WELLNESS_QUIZ_ID_CURATED_LINKS: Partial<
  Record<string, WellnestExternalExample[]>
> = {
  "bpc-157": [
    {
      id: "pubmed-bpc157-gi-review",
      title: "PubMed — Stable gastric pentadecapeptide BPC 157: novel therapy in gastrointestinal tract",
      url: "https://pubmed.ncbi.nlm.nih.gov/21548867/",
      kind: "research",
      note: "Direct paper page (preclinical-heavy evidence base).",
    },
    {
      id: "reddit-bpc157-local-vs-systemic",
      title: "Reddit — BPC-157 / TB-500 local injection vs systemic discussion",
      url: "https://www.reddit.com/r/bpc_157/comments/1r7swnl/bpc157_tb500_local_injection_vs_systemic_for/",
      kind: "reddit",
      note: "Community anecdotes; not clinical guidance.",
    },
  ],
  "tb-500": [
    {
      id: "pubmed-tb4-healthy-volunteers",
      title: "PubMed — Randomized placebo-controlled study of intravenous thymosin beta-4 in healthy volunteers",
      url: "https://pubmed.ncbi.nlm.nih.gov/20536472/",
      kind: "research",
      note: "Direct paper page.",
    },
    {
      id: "pubmed-tb4-venous-ulcers",
      title: "PubMed — Thymosin beta-4 and venous ulcers (prospective randomized study)",
      url: "https://pubmed.ncbi.nlm.nih.gov/17495250/",
      kind: "research",
      note: "Direct paper page.",
    },
    {
      id: "reddit-tb500-protocol-thread",
      title: "Reddit — Wolverine Blend (BPC157/TB500) protocol thread",
      url: "https://www.reddit.com/r/PeptideGuide/comments/1rpnluo/wolverine_blend_bpc157tb500_protocol/",
      kind: "reddit",
      note: "Community protocol discussion; verify clinically.",
    },
  ],
  ipamorelin: [
    {
      id: "pubmed-ipamorelin-selective-ghs",
      title: "PubMed — Ipamorelin, the first selective growth hormone secretagogue",
      url: "https://pubmed.ncbi.nlm.nih.gov/9849822/",
      kind: "research",
      note: "Direct foundational paper page.",
    },
    {
      id: "reddit-cjc-ipamorelin-results",
      title: "Reddit — Personal results discussion for CJC-1295 with Ipamorelin",
      url: "https://www.reddit.com/r/Peptides/comments/mdwlzb/personal_results_and_a_couple_questions_for/",
      kind: "reddit",
      note: "Community anecdote; not medical advice.",
    },
  ],
  semax: [
    {
      id: "pubmed-semax-alz-model",
      title: "PubMed — Semax and derivative in an Alzheimer's disease animal model",
      url: "https://pubmed.ncbi.nlm.nih.gov/41479572/",
      kind: "research",
      note: "Direct paper page; mainly preclinical evidence.",
    },
    {
      id: "pubmed-semax-ischemia-transcriptome",
      title: "PubMed — Semax protective properties after cerebral ischemia-reperfusion",
      url: "https://pubmed.ncbi.nlm.nih.gov/32580520/",
      kind: "research",
      note: "Direct paper page; mostly animal-model data.",
    },
  ],
  selank: [
    {
      id: "reddit-selank-semax-ipamorelin-thread",
      title: "Reddit — Selank / Semax / Ipamorelin discussion thread",
      url: "https://www.reddit.com/r/PeptideDiscussion/comments/1nuwtdi/selank_semax_ipamorelin/",
      kind: "reddit",
      note: "Community anecdote thread; not medical guidance.",
    },
  ],
  pinealon: [
    {
      id: "pubmed-pinealon-cell-viability",
      title: "PubMed — Pinealon increases cell viability and suppresses free radicals",
      url: "https://pubmed.ncbi.nlm.nih.gov/21978084/",
      kind: "research",
      note: "Direct paper page; largely preclinical evidence.",
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

function openWebSearchExamples(
  treatmentName: string,
  idSlug: string,
): WellnestExternalExample[] {
  const q = `${treatmentName} peptide`;
  const encoded = encodeURIComponent(q);
  const redditQ = encodeURIComponent(`${q} review`);
  return [
    {
      id: `news-${idSlug}`,
      title: `Google News — ${treatmentName}`,
      url: `https://news.google.com/search?q=${encoded}`,
      kind: "news",
      note: "Live treatment-specific news search.",
    },
    {
      id: `reddit-${idSlug}`,
      title: `Reddit — Search "${treatmentName}" in r/Peptides`,
      url: `https://www.reddit.com/r/Peptides/search/?q=${redditQ}&restrict_sr=1&sort=top&t=year`,
      kind: "reddit",
      note: "Community discussion filtered to the treatment keyword.",
    },
    {
      id: `youtube-${idSlug}`,
      title: `YouTube — Search "${treatmentName}"`,
      url: `https://www.youtube.com/results?search_query=${encoded}`,
      kind: "youtube",
      note: "Creator videos vary widely in quality; verify claims clinically.",
    },
    {
      id: `ctgov-${idSlug}`,
      title: `ClinicalTrials.gov — Search "${treatmentName}"`,
      url: `https://clinicaltrials.gov/search?term=${encoded}`,
      kind: "research",
      note: "Trial registry for human studies and status.",
    },
  ];
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
  if (quizId && WELLNESS_QUIZ_ID_CURATED_LINKS[quizId]?.length) {
    specific.push(...WELLNESS_QUIZ_ID_CURATED_LINKS[quizId]!);
  }
  if (quizId && WELLNESS_QUIZ_ID_YOUTUBE[quizId]?.length) {
    specific.push(...WELLNESS_QUIZ_ID_YOUTUBE[quizId]!);
  }

  const name = offering.treatmentName.trim();
  const idSlug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "peptide";
  if (!specific.some((x) => x.kind === "reddit")) {
    specific.push(...openWebSearchExamples(name, idSlug).filter((x) => x.kind === "reddit"));
  }
  if (!specific.some((x) => x.kind === "research")) {
    specific.push(pubmedSearchExample(`${name} peptide`, idSlug));
  }

  const merged = [...WELLNEST_EXTERNAL_CONTEXT_LINKS, ...specific];
  return dedupeByUrl(merged);
}

export const WELLNEST_EXTERNAL_LINKS_DISCLAIMER =
  "Links are independent third parties (news, creators, forums, government, research indexes). They are for staff education and patient conversation starters only — not endorsements, not medical advice, and not vetted for accuracy.";
