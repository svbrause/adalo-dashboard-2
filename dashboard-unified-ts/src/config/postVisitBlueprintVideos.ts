/**
 * Clinic-provided vertical videos for the Post-Visit Blueprint patient page.
 * Files live in `public/post-visit-blueprint/videos/` (served at same path).
 */

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
   * keep MOV as fallback for Safari if needed.
   */
  sources: VideoSource[];
  /**
   * Static image shown on the thumbnail before play (recommended).
   * Generate with `npm run extract:blueprint-posters` (requires ffmpeg) or export a frame manually.
   */
  posterUrl?: string;
  /** Used to order videos when they match the treatment plan (treatment/product/region text) */
  matchKeywords: string[];
}

const BASE = "/post-visit-blueprint/videos";
const POSTERS = `${BASE}/posters`;

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
