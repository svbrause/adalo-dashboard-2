/**
 * Clinic-provided vertical videos for the Post-Visit Blueprint patient page.
 * Files live in `public/post-visit-blueprint/videos/` (served at same path).
 * Wellnest MD uses Dr. Reddy Vimeo embeds (see POST_VISIT_BLUEPRINT_WELLNEST_VIMEO_VIDEOS).
 *
 * Thumbnails: Vimeo CDN stills (`d_1280`) where allowed. Some uploads return 403 for CDN
 * hotlinking — override with a local `posterUrl` (see stubborn-fat entry).
 *
 * For on-brand 1280×720 PNGs aligned with Dr. Reddy slide specs, see skin-type-react:
 * `docs/WELLNESS_WELLNEST_REFERENCE.md`, `docs/WELLNEST_DR_REDDY_THUMBNAIL_RECREATION_GUIDE.md`.
 * Drop exports as `public/post-visit-blueprint/videos/wellnest/thumbnails/video-reddy-{1..16}.png`
 * and point `posterUrl` here (slide order matches {@link POST_VISIT_BLUEPRINT_WELLNEST_VIMEO_VIDEOS}).
 */

import type { DiscussedItem } from "../types";
import {
  getWellnestOfferingByTreatmentName,
  isWellnestWellnessProviderCode,
} from "../data/wellnestOfferings";

export type VideoSource = {
  src: string;
  mimeType: "video/mp4" | "video/quicktime";
};

export interface PostVisitBlueprintVideo {
  /** Stable id for analytics */
  id: string;
  /** Short label shown above the player */
  title: string;
  /** One-line context for the patient */
  subtitle: string;
  /**
   * Browser tries sources in order — list MP4 (H.264) first for Chrome/Android;
   * keep MOV as fallback for Safari if needed. Omit when using {@link vimeoId}.
   */
  sources?: VideoSource[];
  /**
   * Static image shown on the thumbnail before play (recommended).
   * Generate with `npm run extract:blueprint-posters` (requires ffmpeg) or export a frame manually.
   */
  posterUrl?: string;
  /**
   * Numeric Vimeo video id (public embed). When set, patient UI uses player.vimeo.com instead of &lt;video&gt;.
   */
  vimeoId?: string;
  /** Used to order videos when they match the treatment plan (treatment/product/region text) */
  matchKeywords: string[];
  /**
   * Wellnest: `wellnessQuizId` values from `wellnestOfferings` / skin-type-react `WELLNESS_TREATMENTS`.
   * Strong signal for which clips belong with a given peptide chapter.
   */
  primaryWellnessQuizIds?: string[];
  /**
   * Wellnest: short phrases distilled from patient-facing case stories / transcripts for soft matching
   * against plan text (addresses, findings, interest).
   */
  educationMatchChunks?: string[];
  /** Wellnest: modest score boost so the intro clip surfaces in most chapters */
  wellnestIntroClip?: boolean;
  /** Optional constructed-thumb key (skin-type-react style): `video-reddy-1` … `video-reddy-16`. */
  wellnestThumbnailImageKey?: string;
}

const BASE = "/post-visit-blueprint/videos";
const POSTERS = `${BASE}/posters`;

/** Cap Dr. Reddy clips per treatment chapter (was effectively “show all”). */
export const WELLNEST_CHAPTER_VIDEO_MAX = 4;

const WELLNEST_INTRO_ID = "reddy_what_are_peptides";

/** Vimeo oEmbed `thumbnail_url` @ 1280px — aligns 1:1 with `WELLNEST_CASE_VIDEOS` order in skin-type-react. */
const WN_POSTER: Record<string, string> = {
  "1174934828":
    "https://i.vimeocdn.com/video/2135641515-1a35a0919713ab6ddbfee06eb4b132b8d598df47f95ae862e519560d0141e1c2-d_1280?region=us",
  "1174934783":
    "https://i.vimeocdn.com/video/2135641460-acb83c719dec50f3e3c5e8f04d9fe479757c2afe808fe0ce1a45cd5494758b15-d_1280?region=us",
  "1174934877":
    "https://i.vimeocdn.com/video/2135641578-47d3af0399303bbcaf6dc721466b527935c0412f663de81d55be5b59e09b4263-d_1280?region=us",
  "1174934938":
    "https://i.vimeocdn.com/video/2135641661-634bf52c6cf1f8a4733dbdec449eabafb3e07ffae6d3dddb990e11fbd89a7db1-d_1280?region=us",
  "1174935318":
    "https://i.vimeocdn.com/video/2135642110-b2257eb2a8ac2fb19cc38a7dae7a004367af5371f8c7fa5a932c125e4c4b1e3c-d_1280?region=us",
  "1174935290":
    "https://i.vimeocdn.com/video/2135642077-06c540a1242fbc2369fb66a01dff4ba64d8a8bce5615cac2f9937413c6079b0c-d_1280?region=us",
  "1174935026":
    "https://i.vimeocdn.com/video/2135641767-c46d0e315c5831915368d95703f06d874dc673dc816fdf3e22db3f222dff7f82-d_1280?region=us",
  "1174935172":
    "https://i.vimeocdn.com/video/2135641955-2915bc1b59b6b090f38ee3daf9f4f677414475b19b659255eece3982e5e09240-d_1280?region=us",
  "1174935268":
    "https://i.vimeocdn.com/video/2135642066-4f48a08984870f7f88dc48bc65bfa44abcf6ad4f538e61fd94fc5ec8b3d52c5b-d_1280?region=us",
  "1174934987":
    "https://i.vimeocdn.com/video/2135642037-a8f0f676b71d99a481229e88a75545ed0b7fc54847256095d98b48f44490b825-d_1280?region=us",
  "1174935129":
    "https://i.vimeocdn.com/video/2135641869-f60c3c611039772940ef1bf7bf1834270b9f6d56b9257ece5bbd6523a920d5b7-d_1280?region=us",
  "1174935244":
    "https://i.vimeocdn.com/video/2135642028-1163a2301655b02552de5980ad23e78d26682f37b3f1077e1e537af37a6c5b86-d_1280?region=us",
  "1174934665":
    "https://i.vimeocdn.com/video/2135641416-2be04c42e8ff65ae666874f5f9f20024aabac0bd1e1c77f0cc8436eaf91f21e0-d_1280?region=us",
  "1174935080":
    "https://i.vimeocdn.com/video/2135641816-05a7591d56d39151dbb8b44009992aff48936f399c05f4ed4e97311402d893d6-d_1280?region=us",
  // 1174935355: Vimeo returns 403 for this asset’s CDN still at d_1280 — use local poster on the clip row.
  "1174935206":
    "https://i.vimeocdn.com/video/2135642012-7a1d236f39ea218235ef55d6c91e5bb1311b5b62fb6252aa5ff6f57b772f1538-d_1280?region=us",
};

function vn(id: string): string | undefined {
  return WN_POSTER[id];
}

/** Default order: laser → targeted filler → general filler FAQ */
export const POST_VISIT_BLUEPRINT_VIDEOS: PostVisitBlueprintVideo[] = [
  {
    id: "moxi_laser",
    title: "Moxi laser",
    subtitle: "Learn how laser resurfacing can refresh your skin.",
    posterUrl: `${POSTERS}/moxi-laser.jpg`,
    sources: [
      { src: `${BASE}/moxi-laser.mp4`, mimeType: "video/mp4" },
      { src: `${BASE}/moxi-laser.mov`, mimeType: "video/quicktime" },
    ],
    matchKeywords: [
      "moxi",
      "laser",
      "energy device",
      "bbl",
      "ipl",
      "broadband",
      "resurfac",
      "sofwave",
      "ultherapy",
    ],
  },
  {
    id: "lower_face_filler_wrinkles",
    title: "Lower face filler for wrinkles",
    subtitle: "How filler can smooth lines in the lower face.",
    posterUrl: `${POSTERS}/lower-face-filler-wrinkles.jpg`,
    sources: [{ src: `${BASE}/lower-face-filler-wrinkles.mp4`, mimeType: "video/mp4" }],
    matchKeywords: [
      "filler",
      "hyaluronic",
      "wrinkle",
      "nasolabial",
      "marionette",
      "jowl",
      "lower face",
      "prejowl",
    ],
  },
  {
    id: "filler_faq",
    title: "Filler FAQ",
    subtitle: "Common questions about dermal filler.",
    posterUrl: `${POSTERS}/filler-faq.jpg`,
    sources: [{ src: `${BASE}/filler-faq.mp4`, mimeType: "video/mp4" }],
    matchKeywords: ["filler", "hyaluronic", "injection", "volum"],
  },
];

/**
 * Dr. Reddy educational clips on Vimeo for Wellnest MD (`Wellnest1300`) patient blueprints.
 * IDs and titles aligned with skin-type-react `WELLNEST_CASE_VIDEOS` / `WELLNEST_CASE_IMAGES`.
 */
export const POST_VISIT_BLUEPRINT_WELLNEST_VIMEO_VIDEOS: PostVisitBlueprintVideo[] = [
  {
    id: "reddy_what_are_peptides",
    title: "What are peptides — start here",
    subtitle: "A short introduction before you dive into your plan.",
    vimeoId: "1174934828",
    posterUrl: vn("1174934828"),
    wellnestThumbnailImageKey: "video-reddy-1",
    wellnestIntroClip: true,
    matchKeywords: [
      "peptide",
      "peptides",
      "bpc",
      "bpc-157",
      "tb-500",
      "thymosin",
      "cjc",
      "ipamorelin",
      "semax",
      "selank",
      "ghrp",
      "igf",
      "lr3",
      "pinealon",
      "p-21",
      "p21",
      "epitalon",
      "ghk",
      "wellness",
      "melanotan",
      "sermorelin",
      "tessamorelin",
      "tesamorelin",
      "aod",
      "cartalax",
      "mk-677",
    ],
  },
  {
    id: "reddy_regenerative_medicine",
    title: "Why peptides are changing regenerative medicine",
    subtitle: "How peptide science fits into modern recovery and wellness.",
    vimeoId: "1174934783",
    posterUrl: vn("1174934783"),
    wellnestThumbnailImageKey: "video-reddy-2",
    primaryWellnessQuizIds: ["bpc-157", "tb-500", "cartalax"],
    educationMatchChunks: [
      "tendon",
      "tissue repair",
      "chronic tendon",
      "regenerative medicine",
      "cartilage",
    ],
    matchKeywords: [
      "peptide",
      "peptides",
      "regenerative",
      "recovery",
      "medicine",
      "healing",
      "injury",
      "tendon",
      "ligament",
      "cartilage",
      "joint",
      "bone",
      "osteoarthritis",
    ],
  },
  {
    id: "reddy_peptide_science_everywhere",
    title: "Why peptide science is everywhere now",
    subtitle: "Context on why you’re hearing more about peptides.",
    vimeoId: "1174934877",
    posterUrl: vn("1174934877"),
    wellnestThumbnailImageKey: "video-reddy-3",
    educationMatchChunks: ["immune modulation", "tissue repair", "metabolism", "cognitive function"],
    matchKeywords: ["peptide", "peptides", "science", "research", "wellness"],
  },
  {
    id: "reddy_fda_approved",
    title: "Which peptides are FDA approved",
    subtitle: "Regulatory context — what “approved” means in this space.",
    vimeoId: "1174934938",
    posterUrl: vn("1174934938"),
    wellnestThumbnailImageKey: "video-reddy-4",
    educationMatchChunks: ["fda approved", "growth hormone", "physician supervision"],
    matchKeywords: ["fda", "approved", "regulatory", "peptide", "peptides", "legal"],
  },
  {
    id: "reddy_myths_vs_facts",
    title: "Peptide myths vs. facts",
    subtitle: "Separating common misconceptions from what we know.",
    vimeoId: "1174935318",
    posterUrl: vn("1174935318"),
    wellnestThumbnailImageKey: "video-reddy-5",
    educationMatchChunks: ["amino acid", "steroids", "social media"],
    matchKeywords: ["peptide", "peptides", "myth", "facts", "safety", "truth"],
  },
  {
    id: "reddy_research_heading",
    title: "Where peptide research is heading",
    subtitle: "A look at emerging directions in peptide science.",
    vimeoId: "1174935290",
    posterUrl: vn("1174935290"),
    wellnestThumbnailImageKey: "video-reddy-6",
    educationMatchChunks: ["neuroprotection", "tissue regeneration", "metabolic disease", "aging biology"],
    matchKeywords: ["research", "future", "peptide", "peptides", "science"],
  },
  {
    id: "reddy_right_for_you",
    title: "Is peptide therapy right for you",
    subtitle: "How to think about fit, goals, and expectations.",
    vimeoId: "1174935026",
    posterUrl: vn("1174935026"),
    wellnestThumbnailImageKey: "video-reddy-7",
    educationMatchChunks: [
      "pregnant",
      "breastfeeding",
      "active cancer",
      "liver",
      "kidney",
      "heart failure",
    ],
    matchKeywords: ["therapy", "right for you", "candidate", "peptide", "peptides", "goals"],
  },
  {
    id: "reddy_metabolism_gh_body",
    title: "Metabolism, growth hormone, and body composition",
    subtitle: "How GH-related peptides tie into energy and composition.",
    vimeoId: "1174935172",
    posterUrl: vn("1174935172"),
    wellnestThumbnailImageKey: "video-reddy-8",
    primaryWellnessQuizIds: [
      "cjc-1295",
      "ipamorelin",
      "ghrp-2-6",
      "igf-1-lr3",
      "mk-677",
      "sermorelin",
      "tessamorelin",
    ],
    educationMatchChunks: [
      "growth hormone",
      "visceral fat",
      "muscle recovery",
      "sleep",
      "body composition",
    ],
    matchKeywords: [
      "metabolism",
      "growth hormone",
      "gh",
      "body composition",
      "cjc",
      "ipamorelin",
      "ghrp",
      "muscle",
      "energy",
      "sermorelin",
      "tesamorelin",
      "tessamorelin",
      "mk-677",
      "igf",
    ],
  },
  {
    id: "reddy_copper_peptide_derm",
    title: "The copper peptide turning heads in dermatology",
    subtitle: "GHK-Cu and skin-focused peptide science.",
    vimeoId: "1174935268",
    posterUrl: vn("1174935268"),
    wellnestThumbnailImageKey: "video-reddy-9",
    primaryWellnessQuizIds: ["ghk-cu"],
    educationMatchChunks: ["collagen", "wound healing", "antioxidant", "dermatology"],
    matchKeywords: ["copper", "ghk", "ghk-cu", "dermatology", "skin", "peptide", "collagen", "melanin", "tanning"],
  },
  {
    id: "reddy_recovery_stack",
    title: "The recovery stack — healing faster after injury",
    subtitle: "Injury recovery angles often discussed with BPC-157 and related peptides.",
    vimeoId: "1174934987",
    posterUrl: vn("1174934987"),
    wellnestThumbnailImageKey: "video-reddy-10",
    primaryWellnessQuizIds: ["bpc-157", "tb-500"],
    educationMatchChunks: ["tendon", "ligament", "soft tissue", "injury recovery", "healing"],
    matchKeywords: [
      "recovery",
      "injury",
      "healing",
      "bpc",
      "bpc-157",
      "tb-500",
      "thymosin",
      "stack",
      "tendon",
      "ligament",
      "gut",
      "inflammation",
    ],
  },
  {
    id: "reddy_skin_regeneration",
    title: "Can peptides support skin regeneration",
    subtitle: "Skin repair and regeneration from a peptide lens.",
    vimeoId: "1174935129",
    posterUrl: vn("1174935129"),
    wellnestThumbnailImageKey: "video-reddy-11",
    primaryWellnessQuizIds: ["ghk-cu", "melanotan-2"],
    educationMatchChunks: ["skin repair", "regeneration", "collagen", "anti-aging"],
    matchKeywords: [
      "skin",
      "regeneration",
      "repair",
      "peptide",
      "peptides",
      "collagen",
      "anti-aging",
      "melanin",
      "tanning",
      "melanotan",
    ],
  },
  {
    id: "reddy_metabolism_body_comp",
    title: "Peptides for metabolism and body composition",
    subtitle: "Energy, signaling, and lean-mass support.",
    vimeoId: "1174935244",
    posterUrl: vn("1174935244"),
    wellnestThumbnailImageKey: "video-reddy-12",
    primaryWellnessQuizIds: [
      "cjc-1295",
      "ipamorelin",
      "ghrp-2-6",
      "igf-1-lr3",
      "mk-677",
      "sermorelin",
      "tessamorelin",
      "aod-9604",
    ],
    educationMatchChunks: ["lean mass", "energy", "fat metabolism", "signaling"],
    matchKeywords: ["metabolism", "body composition", "fat", "lean", "cjc", "ipamorelin", "igf", "ghrp", "aod", "obesity"],
  },
  {
    id: "reddy_rapid_fire_guide",
    title: "Dr. Reddy’s rapid-fire peptide guide",
    subtitle: "Quick hits across popular peptide topics.",
    vimeoId: "1174934665",
    posterUrl: vn("1174934665"),
    wellnestThumbnailImageKey: "video-reddy-13",
    educationMatchChunks: ["rapid", "overview", "popular peptide"],
    matchKeywords: ["peptide", "peptides", "guide", "overview", "rapid", "bpc", "tb-500", "cjc", "semax"],
  },
  {
    id: "reddy_neuropeptides_focus_calm",
    title: "Neuropeptides for focus and calm",
    subtitle: "Cognitive and mood-adjacent peptide angles.",
    vimeoId: "1174935080",
    posterUrl: vn("1174935080"),
    wellnestThumbnailImageKey: "video-reddy-14",
    primaryWellnessQuizIds: ["semax", "selank", "p21", "pinealon"],
    educationMatchChunks: ["brain fog", "anxiety", "stress", "mood", "cognitive", "focus"],
    matchKeywords: [
      "neuropeptide",
      "focus",
      "calm",
      "anxiety",
      "stress",
      "semax",
      "selank",
      "brain",
      "cognitive",
      "mood",
      "memory",
    ],
  },
  {
    id: "reddy_stubborn_fat_metabolic",
    title: "Stubborn fat and metabolic signaling",
    subtitle: "Metabolic peptides and stubborn fat patterns.",
    vimeoId: "1174935355",
    // Vimeo still is currently blocked (403), keep a neutral local fallback.
    posterUrl: `${BASE}/wellnest/Dr-Reddy-qr-code.png`,
    wellnestThumbnailImageKey: "video-reddy-15",
    primaryWellnessQuizIds: ["aod-9604", "tessamorelin", "mk-677", "cjc-1295"],
    educationMatchChunks: ["stubborn fat", "metabolic", "visceral", "signaling"],
    matchKeywords: ["fat", "metabolic", "metabolism", "weight", "stubborn", "aod", "cjc", "peptide", "obesity"],
  },
  {
    id: "reddy_epitalon_longevity",
    title: "Longevity and cellular aging — the Epitalon story",
    subtitle: "Longevity framing around Epitalon and related science.",
    vimeoId: "1174935206",
    posterUrl: vn("1174935206"),
    wellnestThumbnailImageKey: "video-reddy-16",
    primaryWellnessQuizIds: ["epitalon", "pinealon"],
    educationMatchChunks: ["cellular aging", "longevity", "aging biology", "epitalon"],
    matchKeywords: ["epitalon", "longevity", "aging", "cellular", "pinealon", "anti-aging", "peptide"],
  },
];

/** Video catalog for `/tp` blueprint: aesthetic MP4s by default; Dr. Reddy Vimeo set for Wellnest. */
export function getPostVisitBlueprintVideoCatalog(
  providerCode?: string | null,
): PostVisitBlueprintVideo[] {
  return isWellnestWellnessProviderCode(providerCode)
    ? POST_VISIT_BLUEPRINT_WELLNEST_VIMEO_VIDEOS
    : POST_VISIT_BLUEPRINT_VIDEOS;
}

/** True when the catalog is the all-Vimeo Wellnest set (per-chapter limiting applies). */
export function isWellnestVimeoVideoCatalog(catalog: PostVisitBlueprintVideo[]): boolean {
  return catalog.length > 0 && catalog.every((v) => Boolean(v.vimeoId));
}

function planHaystack(
  discussedItems: { treatment?: string; product?: string; region?: string; findings?: string[] }[],
): string {
  const parts: string[] = [];
  for (const item of discussedItems) {
    if (item.treatment) parts.push(item.treatment);
    if (item.product) parts.push(item.product);
    if (item.region) parts.push(item.region);
    if (item.findings?.length) parts.push(...item.findings);
  }
  return parts.join(" ").toLowerCase();
}

function wellnestChapterContext(items: DiscussedItem[]): {
  haystack: string;
  wellnessQuizIds: Set<string>;
} {
  const wellnessQuizIds = new Set<string>();
  const parts: string[] = [];
  for (const i of items) {
    const t = i.treatment?.trim();
    if (t) {
      const o = getWellnestOfferingByTreatmentName(t);
      if (o?.wellnessQuizId) wellnessQuizIds.add(o.wellnessQuizId);
      parts.push(
        t,
        o?.addresses ?? "",
        o?.category ?? "",
        o?.demographics ?? "",
        o?.notes ?? "",
      );
    }
    if (i.product?.trim()) parts.push(i.product);
    if (i.region?.trim()) parts.push(i.region);
    if (i.interest?.trim()) parts.push(i.interest);
    if (i.findings?.length) parts.push(...i.findings);
  }
  return { haystack: parts.join(" ").toLowerCase(), wellnessQuizIds };
}

const WELLNEST_MIN_SCORE = 16;

function scoreWellnestVideo(
  video: PostVisitBlueprintVideo,
  haystack: string,
  wellnessQuizIds: Set<string>,
): number {
  let s = 0;
  const prim = video.primaryWellnessQuizIds;
  if (prim?.length) {
    for (const id of prim) {
      if (wellnessQuizIds.has(id)) s += 120;
    }
  }
  for (const kw of video.matchKeywords) {
    if (haystack.includes(kw.toLowerCase())) s += 4;
  }
  for (const chunk of video.educationMatchChunks ?? []) {
    const c = chunk.toLowerCase();
    if (c.length >= 4 && haystack.includes(c)) s += 8;
  }
  if (video.wellnestIntroClip) s += 32;
  return s;
}

function selectWellnestChapterVideos(
  items: DiscussedItem[],
  catalog: PostVisitBlueprintVideo[],
): PostVisitBlueprintVideo[] {
  const { haystack, wellnessQuizIds } = wellnestChapterContext(items);
  if (!haystack.trim()) return [];

  const scored = catalog.map((video) => ({
    video,
    score: scoreWellnestVideo(video, haystack, wellnessQuizIds),
  }));
  const ranked = scored
    .filter((x) => x.score >= WELLNEST_MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  const picked = ranked.slice(0, WELLNEST_CHAPTER_VIDEO_MAX).map((x) => x.video);
  if (picked.length > 0) return picked;

  const intro = catalog.find((v) => v.id === WELLNEST_INTRO_ID);
  return intro ? [intro] : [];
}

function selectDefaultChapterVideos(
  items: DiscussedItem[],
  catalog: PostVisitBlueprintVideo[],
): PostVisitBlueprintVideo[] {
  const haystack = items
    .flatMap((i) => [i.treatment, i.product, i.region, ...(i.findings ?? [])])
    .filter(Boolean)
    .map((x) => String(x).toLowerCase())
    .join(" ");
  if (!haystack.trim()) return [];
  return orderBlueprintVideosForPlan(items, catalog).filter((v) =>
    v.matchKeywords.some((kw) => haystack.includes(kw.toLowerCase())),
  );
}

/**
 * Videos for one treatment chapter: Wellnest → scored + capped; default → keyword filter.
 */
export function selectVideosForChapterPlanItems(
  items: DiscussedItem[],
  catalog: PostVisitBlueprintVideo[],
): PostVisitBlueprintVideo[] {
  if (isWellnestVimeoVideoCatalog(catalog)) {
    return selectWellnestChapterVideos(items, catalog);
  }
  return selectDefaultChapterVideos(items, catalog);
}

function relevanceScore(video: PostVisitBlueprintVideo, haystack: string): number {
  if (!haystack.trim()) return 0;
  let score = 0;
  for (const kw of video.matchKeywords) {
    if (haystack.includes(kw.toLowerCase())) score += 1;
  }
  return score;
}

/** Order videos: most relevant to the plan first, then default catalog order. */
export function orderBlueprintVideosForPlan(
  discussedItems: { treatment?: string; product?: string; region?: string; findings?: string[] }[],
  catalog: PostVisitBlueprintVideo[] = POST_VISIT_BLUEPRINT_VIDEOS,
): PostVisitBlueprintVideo[] {
  const haystack = planHaystack(discussedItems);
  const withIndex = catalog.map((video, catalogIndex) => ({
    video,
    catalogIndex,
    score: relevanceScore(video, haystack),
  }));
  withIndex.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.catalogIndex - b.catalogIndex;
  });
  return withIndex.map((x) => x.video);
}
