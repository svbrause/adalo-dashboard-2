/**
 * Dr. Reddy thumbnail layout data for Wellnest Vimeo clips.
 * Mirrors the skin-type-react live thumbnail system.
 */
export type WellnestLayoutType =
  | "split-left"
  | "split-right"
  | "bottom-text"
  | "corner-box";

export interface WellnestSlideConfig {
  layout: WellnestLayoutType;
  themeColor: string;
  text1: string;
  text2?: string;
  text3?: string;
  highlightLine?: 1 | 2;
  faceScale: number;
  faceX: string;
  faceY: string;
  useVial?: 1 | 2 | 3;
}

const CHARCOAL = "#232323";
const MINT = "#63D4AC";
const TEAL = "#4ab896";
const CORAL = "#e07c4a";
const LIGHT_BLUE = "#a8c4cc";

export const WELLNEST_THUMBNAIL_SLIDES: WellnestSlideConfig[] = [
  { layout: "split-right", themeColor: MINT, text1: "PEPTIDES", text2: "EXPLAINED", highlightLine: 1, faceScale: 1.5, faceX: "88%", faceY: "15%" },
  { layout: "corner-box", themeColor: TEAL, text1: "THE REGEN", text2: "REVOLUTION", text3: "Why peptides matter", faceScale: 1.3, faceX: "18%", faceY: "15%" },
  { layout: "bottom-text", themeColor: CORAL, text1: "WHY NOW?", text2: "THE PEPTIDE TREND", highlightLine: 1, faceScale: 1.3, faceX: "28%", faceY: "15%" },
  { layout: "split-left", themeColor: MINT, text1: "FDA", text2: "APPROVED?", text3: "The Facts", highlightLine: 1, faceScale: 1.4, faceX: "12%", faceY: "15%" },
  { layout: "split-right", themeColor: TEAL, text1: "3 MYTHS", text2: "BUSTED", highlightLine: 2, faceScale: 1.5, faceX: "88%", faceY: "15%" },
  { layout: "corner-box", themeColor: MINT, text1: "THE FUTURE", text2: "OF RESEARCH", faceScale: 1.2, faceX: "18%", faceY: "15%" },
  { layout: "bottom-text", themeColor: LIGHT_BLUE, text1: "IS IT RIGHT", text2: "FOR YOU?", highlightLine: 2, faceScale: 1.3, faceX: "72%", faceY: "15%" },
  { layout: "split-left", themeColor: TEAL, text1: "METABOLISM", text2: "BOOST", text3: "Growth Hormone explained", highlightLine: 1, faceScale: 1.4, faceX: "12%", faceY: "15%" },
  { layout: "split-right", themeColor: CORAL, text1: "SKINCARE", text2: "PEPTIDES", text3: "Which one?", highlightLine: 1, faceScale: 1.3, faceX: "82%", faceY: "40%", useVial: 1 },
  { layout: "corner-box", themeColor: MINT, text1: "RECOVERY", text2: "STACK", text3: "Heal faster", faceScale: 1.3, faceX: "18%", faceY: "15%" },
  { layout: "bottom-text", themeColor: TEAL, text1: "SKIN", text2: "REGENERATION?", highlightLine: 1, faceScale: 1.3, faceX: "28%", faceY: "15%" },
  { layout: "split-left", themeColor: CORAL, text1: "BODY", text2: "COMPOSITION", highlightLine: 2, faceScale: 1.4, faceX: "12%", faceY: "15%" },
  { layout: "corner-box", themeColor: LIGHT_BLUE, text1: "DR. REDDY'S", text2: "GUIDE", text3: "Rapid-fire facts", faceScale: 1.2, faceX: "18%", faceY: "15%" },
  { layout: "split-right", themeColor: MINT, text1: "FOCUS", text2: "& CALM", text3: "Neuropeptides", highlightLine: 1, faceScale: 1.5, faceX: "88%", faceY: "15%" },
  { layout: "bottom-text", themeColor: TEAL, text1: "STUBBORN", text2: "FAT?", highlightLine: 2, faceScale: 1.3, faceX: "72%", faceY: "15%" },
  { layout: "split-left", themeColor: CHARCOAL, text1: "CELLULAR", text2: "AGING", text3: "The Epitalon Story", highlightLine: 1, faceScale: 1.1, faceX: "12%", faceY: "50%", useVial: 2 },
];

const REDDY_INDEX_RE = /^video-reddy-(\d+)$/;

export function getWellnestThumbnailSlide(
  imageKey: string | undefined,
): WellnestSlideConfig | null {
  if (!imageKey) return null;
  const m = imageKey.match(REDDY_INDEX_RE);
  if (!m) return null;
  const index = parseInt(m[1], 10) - 1;
  if (index < 0 || index >= WELLNEST_THUMBNAIL_SLIDES.length) return null;
  return WELLNEST_THUMBNAIL_SLIDES[index];
}

export const WELLNEST_DR_REDDY_IMAGE =
  "/post-visit-blueprint/videos/wellnest/Dr-Reddy-qr-code.png";

export const WELLNEST_VIAL_IMAGES: Record<1 | 2 | 3, string> = {
  1: "/post-visit-blueprint/videos/wellnest/thumbnails/vials/vial-1.png",
  2: "/post-visit-blueprint/videos/wellnest/thumbnails/vials/vial-2.png",
  3: "/post-visit-blueprint/videos/wellnest/thumbnails/vials/vial-3.png",
};
