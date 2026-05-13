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
import { isJudgeMdProviderCode } from "../data/judgeMdPricing2026";

export type VideoSource = {
  src: string;
  mimeType: "video/mp4" | "video/quicktime";
};

export type VideoCaptionTrack = {
  src: string;
  label: string;
  srclang: string;
  kind: "captions" | "subtitles";
  default?: boolean;
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
  /** Optional WebVTT caption/subtitle tracks shown by the native video controls. */
  captions?: VideoCaptionTrack[];
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
  /**
   * Default aesthetic catalog: when true, {@link matchKeywords} are checked only against
   * product / region / findings / interest / notes — not the treatment label.
   * Use so a clip (e.g. Moxi) does not appear for every row of that treatment (e.g. all Energy Treatment).
   */
  matchAgainstPlanSpecificsOnly?: boolean;
  /** Require the chapter's skincare plan row to be a moisturizer/barrier-cream product. */
  requiresSkincareProductRole?: "moisturizer";
}

const BASE = "/post-visit-blueprint/videos";
const POSTERS = `${BASE}/posters`;
const JUDGEMD_GCS_BASE =
  "https://storage.googleapis.com/test-deploy-august25/post-visit-blueprint/videos/judgemd";

/** Cap Dr. Reddy clips per treatment chapter (was effectively “show all”). */
export const WELLNEST_CHAPTER_VIDEO_MAX = 4;
/** JudgeMD has a large reel library; keep each treatment chapter focused. */
export const JUDGEMD_CHAPTER_VIDEO_MAX = 6;

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
    matchAgainstPlanSpecificsOnly: true,
    matchKeywords: [
      "moxi",
      // Matches "Moxi + BBL" / "BBL + Moxi" product strings without tying this clip to other lasers
      "moxi + bbl",
      "bbl + moxi",
    ],
  },
  {
    id: "lower_face_filler_wrinkles",
    title: "Lower face filler for wrinkles",
    subtitle: "How filler can smooth lines in the lower face.",
    posterUrl: `${POSTERS}/lower-face-filler-wrinkles.jpg`,
    sources: [{ src: `${BASE}/lower-face-filler-wrinkles.mp4`, mimeType: "video/mp4" }],
    matchAgainstPlanSpecificsOnly: true,
    matchKeywords: [
      "wrinkle",
      "nasolabial",
      "marionette",
      "jowl",
      "lower face",
      "prejowl",
      "prejowl sulcus",
      "marionette line",
      "nasolabial fold",
    ],
  },
  {
    id: "filler_faq",
    title: "Filler FAQ",
    subtitle: "Common questions about dermal filler.",
    posterUrl: `${POSTERS}/filler-faq.jpg`,
    sources: [{ src: `${BASE}/filler-faq.mp4`, mimeType: "video/mp4" }],
    /** Avoid "injection" — matches PRFM injections, cortisone injections, etc. */
    matchAgainstPlanSpecificsOnly: true,
    matchKeywords: [
      "filler",
      "hyaluronic",
      "volum",
      "juvederm",
      "restylane",
      "belotero",
      "versa",
      "volux",
      "voluma",
      "tear trough",
      "dermal filler",
    ],
  },
];

const JUDGEMD_REEL_FILES = [
  "Reels/How to Heal After Your Labiaplasty.mov",
  "Reels/How to Prepare for a Labiaplasty.mov",
  "Reels/How to Tape Your Nose After a Rhinoplasty.mov",
  "Reels 2/ae04587ba43f481a830a46d81f591b9f.mov",
  "Reels 2/Beautiful Lip Filler Before & After(1).mov",
  "Reels 2/Botox on Your Traps_.mov",
  "Reels 2/Did You Know You Can Use Botox to Create a Brow Lift_.mov",
  "Reels 2/Facial Balancing Using Filler.mov",
  "Reels 2/Filler Migration_ What You Need to Know - Copy 1.mov",
  "Reels 2/How Did He Get Tall_ Incoming Stitch.mov",
  "Reels 2/How I Break Your Nose During a Rhinoplasty - Edited Copy 1_.mov",
  "Reels 2/How I Break Your Nose During a Rhinoplasty - Edited Copy 2_.mov",
  "Reels 2/How I Got This Patient Snatched.mov",
  "Reels 2/How Long Does it Take to Get Filler Injected_.mov",
  "Reels 2/How Much Does Botox Cost_.mov",
  "Reels 2/How To_ Lymphatic Massage.mov",
  "Reels 2/Injecting Filler to Make Jawline_.mov",
  "Reels 2/Injecting Myself with Dysport.mov",
  "Reels 2/One of My Favorite Rhinoplasties.mov",
  "Reels 2/Plastic Surgeon’s Advice on Anti-Aging.mov",
  "Reels 2/Rhinoplasty Risks.mov",
  "Reels 2/Sculpting My Nose with Botox_.mov",
  "Reels 2/Showing How Much Filler 1 Syringe is - Copy 1.mov",
  "Reels 2/Stunning Results with My Angelina Jolie Lip Cleavage Technique!.mov",
  "Reels 2/Testing Out the New _Longer Lasting_ Botox Alternative!.mov",
  "Reels 2/Under Eye Filler Transformation.mov",
  "Reels 2/Using Botox_ Slimming Out a Square Jaw.mov",
  "Reels 2/What are Botox Bumps_.mov",
  "Reels 2/What is a Liquid Rhinoplasty_.mov",
  "Reels 2/What is an Asian Rhinoplasty_ - Copy 1.mov",
  "Reels 2/Why Do I need to Get Botox Done Every Few Months_.mov",
  "Reels 2/Why You Shouldn_t Dissolve & Refill the Same Day.mov",
  "Reels 2/Why You Shouldn_t Get Filler Before a Wedding.mov",
  "Reels 3/3 Things to Know Before Getting Filler.mov",
  "Reels 3/Are Rhinoplasties Painful_.mov",
  "Reels 3/Botox vs Dysport.mov",
  "Reels 3/Doctor, Your Surgery Didn_t Work, I_m Fat Again.mov",
  "Reels 3/Does Botox Create Excess Sweating in Other Places_.mov",
  "Reels 3/efa8662c11b14b4e9f1489de0b2bf87e.mov",
  "Reels 3/Filler in Your Temples_.mov",
  "Reels 3/How Long Will My Filler Last_ When Do I need to Get Refilled_.mov",
  "Reels 3/How to Accentuate Your Natural Features_.mov",
  "Reels 3/How to Fix Your Hip Dips.mov",
  "Reels 3/Injections I_ve Had Done.mov",
  "Reels 3/Is Non-Surgical Rhinoplasty Worth It_.mov",
  "Reels 3/Masseter Botox_.mov",
  "Reels 3/The Internet_s Most Dangerous DIY Beauty Trend.mov",
  "Reels 3/Using Thread Lifts to the Nose.mov",
  "Reels 3/What is a Fat Transfer to the Nose_.mov",
  "Reels 3/Who Can Be an _Injector_.mov",
  "Reels 3/Why Lip Flips Can Look Bad.mov",
  "Reels 3/Why We Ask if You_re a Smoker Before Getting Surgery.mov",
  "Reels 4/22b9f8ffe440463b96ebf08492198f95.mov",
  "Reels 4/Alternative to Getting a BBL.mov",
  "Reels 4/Beautiful Lip Filler Before & After.mov",
  "Reels 4/Beautiful Nose Transformation.mov",
  "Reels 4/Before and After Botox to the Masseters.mov",
  "Reels 4/Cheek and Chin Filler Before_After.mov",
  "Reels 4/Crazy Button Nose Transformation.mov",
  "Reels 4/Does Lip Filler Cause Lip Twitches_.mov",
  "Reels 4/Filler Migration_ What You Need to Know - Copy 2.mp4",
  "Reels 4/Fixing Damaged Nose - Fat Transfer.mov",
  "Reels 4/Full Facial Balancing With Filler.mov",
  "Reels 4/Full Facial Balancing With Filler(1).mov",
  "Reels 4/Full Facial Balancing with Filler(2).mov",
  "Reels 4/Getting Snatched with Fillers.mov",
  "Reels 4/Giving My Patient Boobs.mov",
  "Reels 4/Gummy Smile Injections.mov",
  "Reels 4/How Botox Helps Teeth Grinding.mov",
  "Reels 4/How Easy Can Your Breast Implants Pop_.mov",
  "Reels 4/How Fast Dysport Works.mov",
  "Reels 4/How I Break Your Nose During a Rhinoplasty - Edited Copy 3.mov",
  "Reels 4/How I Break Your Nose During a Rhinoplasty - Long Copy_.mov",
  "Reels 4/How I Fixed His Nose.mov",
  "Reels 4/How I Make Rhinoplasties Look Natural.mov",
  "Reels 4/I Taped My Forehead Every Night for 1 Week.mov",
  "Reels 4/Insane Nose Transformation.mov",
  "Reels 4/Lip Filler After Care - Copy 1.mov",
  "Reels 4/Lip Filler After Care - Copy 2.mov",
  "Reels 4/Liquid Rhinoplasty Results.mov",
  "Reels 4/No Gatekeeping What I’ve Had Injected.mov",
  "Reels 4/One of the Most Underrated Places to get Filler, The Chin.mov",
  "Reels 4/Plump But Natural Lip Fillers Results.mov",
  "Reels 4/Pouty Lip Transformation.mov",
  "Reels 4/Rhinoplasty & Eyelid Transformation.mov",
  "Reels 4/Should You Get A Lip Flip_.mov",
  "Reels 4/Showing How Much Filler 1 Syringe is - Copy 2.mov",
  "Reels 4/Showing My “Before Rhinoplasty” Nose.mov",
  "Reels 4/This is How I Slim Out Your Nose.mov",
  "Reels 4/Transformational Rhinoplasty Before and After.mov",
  "Reels 4/Using Glue as Lip Filer.mov",
  "Reels 4/When Patient Reacts Like This.mov",
  "Reels 4/When they love their results_.mov",
  "Reels 4/Why Is Everyone Getting Buccal Fat Pad Removal_.mov",
  "Reels 5/Casey Neistat_s Take On Cosmetic Surgery - Under Eye Surgery.mov",
  "Reels 5/Does Lip Filler Affect Kissing_.mov",
  "Reels 5/Hip Dip Filler - Part 1.mov",
  "Reels 5/Hip Dip Filler - Part 2.mov",
  "Reels 5/How Much Does Filler Cost_.mov",
  "Reels 5/How to Choose the Right Plastic Surgeon.mov",
  "Reels 5/Injecting My Own Botox.mov",
  "Reels 5/Misconceptions on Under Eye Filler.mov",
  "Reels 5/The Correct Way to Put Moisturizer On - copy 1.mov",
  "Reels 5/The Correct Way to Put Moisturizer On - copy 2.mov",
  "Reels 5/What are Russian Doll Lips_.mov",
  "Reels 5/What is a Lip Flip_.mov",
  "Reels 5/What is the Crunching Sound When Getting Botox_.mov",
  "Reels 5/Why BBLs are so Dangerous.mov",
] as const;

function fileStem(path: string): string {
  return path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? path;
}

function judgeMdVideoTitleFromPath(path: string): string {
  return fileStem(path)
    .replace(/\s+-\s+Edited Copy \d+\??$/i, "")
    .replace(/\s+-\s+Long Copy_?$/i, "")
    .replace(/\s+-\s+Copy \d+$/i, "")
    .replace(/\(\d+\)$/g, "")
    .replace(/Before_After/gi, "Before/After")
    .replace(/Shouldn_t/gi, "Shouldn't")
    .replace(/Didn_t/gi, "Didn't")
    .replace(/Doesn_t/gi, "Doesn't")
    .replace(/Don_t/gi, "Don't")
    .replace(/You_re/gi, "You're")
    .replace(/I_m/gi, "I'm")
    .replace(/I_ve/gi, "I've")
    .replace(/([A-Za-z])_s\b/g, "$1's")
    .replace(/\s+_([^_]+)_/g, ' "$1"')
    .replace(/_$/g, "?")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function judgeMdVideoIdFromPath(path: string): string {
  return `judgemd_${path
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;
}

function judgeMdVideoSubtitle(title: string): string {
  const lower = title.toLowerCase();
  if (/prepare|heal|after care|tape|lymphatic|risks/.test(lower)) {
    return "Helpful preparation and after-care guidance from JudgeMD.";
  }
  if (/before|after|transformation|results|reacts/.test(lower)) {
    return "";
  }
  return "A short JudgeMD education clip related to this treatment.";
}

function judgeMdVideoKeywords(title: string): string[] {
  const lower = title.toLowerCase();
  const keywords = new Set<string>([lower]);
  const add = (...values: string[]) => {
    for (const v of values) keywords.add(v);
  };

  if (
    /botox|dysport|toxin|masseter|traps|brow lift|lip flip|gummy smile|teeth grinding|crunching|sweating|bumps|square jaw/.test(
      lower,
    )
  ) {
    add(
      "neurotoxin",
      "botox",
      "dysport",
      "daxxify",
      "masseter",
      "forehead",
      "brow",
      "gummy smile",
      "teeth grinding",
      "traps",
    );
  }
  if (
    /filler|fillers|syringe|lip|lips|jawline|chin|cheek|temple|tear trough|under eye|facial balancing|hip dip|liquid rhinoplasty|dissolve|migration|kissing|russian doll/.test(
      lower,
    )
  ) {
    add(
      "filler",
      "dermal filler",
      "hyaluronic",
      "lip filler",
      "jawline",
      "chin",
      "cheek",
      "temple",
      "tear trough",
      "under eye",
      "facial balancing",
      "liquid rhinoplasty",
      "hip dip",
    );
  }
  if (/rhinoplasty|nose|nasal/.test(lower)) {
    add(
      "rhinoplasty",
      "facial surgery",
      "nose",
      "nose reshaping",
      "tip rhinoplasty",
      "revision rhinoplasty",
      "liquid rhinoplasty",
    );
  }
  if (/eyelid|under eye surgery|blepharoplasty/.test(lower)) {
    add("facial surgery", "blepharoplasty", "eyelid", "eyes", "under eye");
  }
  if (/thread lift|buccal|forehead|fat transfer to the nose|fat transfer/.test(lower)) {
    add("facial surgery", "thread lift", "buccal fat", "forehead", "fat transfer");
  }
  if (/labiaplasty|vaginal/.test(lower)) {
    add("vaginal rejuvenation", "labiaplasty", "vaginal");
  }
  if (/breast|boobs|implant/.test(lower)) {
    add("breast surgery", "breast augmentation", "breast implants");
  }
  if (/bbl|body|snatched|lymphatic|hip dip|liposuction|fat again/.test(lower)) {
    add("body sculpting", "liposuction", "bbl", "hip dip", "body contouring");
  }
  if (/moisturizer|anti-aging|skin/.test(lower)) {
    add("skincare", "skin", "anti-aging", "moisturizer");
  }
  if (/plastic surgeon|cosmetic surgery|injector/.test(lower)) {
    add("plastic surgery", "cosmetic surgery", "facial surgery", "body sculpting");
  }

  return Array.from(keywords);
}

function judgeMdVideoFromPath(path: string): PostVisitBlueprintVideo {
  const title = judgeMdVideoTitleFromPath(path);
  const id = judgeMdVideoIdFromPath(path);
  const isMoisturizerEducation = /correct way to put moisturizer on/i.test(title);
  return {
    id,
    title,
    subtitle: judgeMdVideoSubtitle(title),
    posterUrl: `${JUDGEMD_GCS_BASE}/posters/${id}.jpg`,
    captions: [
      {
        src: `${JUDGEMD_GCS_BASE}/captions/${id}.vtt`,
        label: "English",
        srclang: "en",
        kind: "captions",
        default: true,
      },
    ],
    sources: [
      {
        src: `${JUDGEMD_GCS_BASE}/videos/${id}.mp4`,
        mimeType: "video/mp4",
      },
    ],
    matchAgainstPlanSpecificsOnly: isMoisturizerEducation || undefined,
    requiresSkincareProductRole: isMoisturizerEducation ? "moisturizer" : undefined,
    matchKeywords: isMoisturizerEducation
      ? [
          "moisturizer",
          "moisturizing",
          "moisture",
          "daily moisture",
          "triple lipid",
          "emollience",
          "hydra balm",
          "renew overnight",
          "cream",
          "barrier",
        ]
      : judgeMdVideoKeywords(title),
  };
}

export const POST_VISIT_BLUEPRINT_JUDGEMD_VIDEOS: PostVisitBlueprintVideo[] =
  JUDGEMD_REEL_FILES.map(judgeMdVideoFromPath);

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
  if (isWellnestWellnessProviderCode(providerCode)) {
    return POST_VISIT_BLUEPRINT_WELLNEST_VIMEO_VIDEOS;
  }
  if (isJudgeMdProviderCode(providerCode)) {
    return POST_VISIT_BLUEPRINT_JUDGEMD_VIDEOS;
  }
  return POST_VISIT_BLUEPRINT_VIDEOS;
}

/** True when the catalog is the all-Vimeo Wellnest set (per-chapter limiting applies). */
export function isWellnestVimeoVideoCatalog(catalog: PostVisitBlueprintVideo[]): boolean {
  return catalog.length > 0 && catalog.every((v) => Boolean(v.vimeoId));
}

/** True when the active catalog is JudgeMD's local reel set. */
export function isJudgeMdReelVideoCatalog(catalog: PostVisitBlueprintVideo[]): boolean {
  return catalog.length > 0 && catalog.every((v) => v.id.startsWith("judgemd_"));
}

function planHaystack(
  discussedItems: {
    treatment?: string;
    product?: string;
    region?: string;
    findings?: string[];
    interest?: string;
    notes?: string;
  }[],
): string {
  const parts: string[] = [];
  for (const item of discussedItems) {
    if (item.treatment) parts.push(item.treatment);
    if (item.product) parts.push(item.product);
    if (item.region) parts.push(item.region);
    if (item.interest) parts.push(item.interest);
    if (item.notes) parts.push(item.notes);
    if (item.findings?.length) parts.push(...item.findings);
  }
  return parts.join(" ").toLowerCase();
}

/** Text used when {@link PostVisitBlueprintVideo.matchAgainstPlanSpecificsOnly} is true — excludes treatment name. */
function planSpecificHaystack(items: DiscussedItem[]): string {
  const parts: string[] = [];
  for (const item of items) {
    if (item.product?.trim()) parts.push(item.product);
    if (item.region?.trim()) parts.push(item.region);
    if (item.interest?.trim()) parts.push(item.interest);
    if (item.notes?.trim()) parts.push(item.notes);
    if (item.findings?.length) parts.push(...item.findings);
  }
  return parts.join(" ").toLowerCase();
}

function isSkincareMoisturizerPlanItem(item: DiscussedItem): boolean {
  if ((item.treatment ?? "").trim().toLowerCase() !== "skincare") return false;
  const text = [item.product, item.notes]
    .map((v) => v?.trim() ?? "")
    .join(" ")
    .toLowerCase();
  if (!text) return false;
  if (/\b(eye|lip)\b/.test(text) && /\b(cream|balm|treatment)\b/.test(text)) {
    return false;
  }
  if (
    /\b(cleanser|cleansing|wash|toner|mist|mask|scrub|spf|sunscreen|uv defense|serum|retinol)\b/.test(
      text,
    ) &&
    !/\b(moisturizer|moisturizing|moisture|cream|balm|barrier)\b/.test(text)
  ) {
    return false;
  }
  return /\b(moisturizer|moisturizing|moisture|daily moisture|triple lipid|emollience|hydra balm|renew overnight|cream|gel-cream|barrier)\b/.test(
    text,
  );
}

function chapterHasRequiredVideoSkincareRole(
  items: DiscussedItem[],
  role: PostVisitBlueprintVideo["requiresSkincareProductRole"],
): boolean {
  if (!role) return true;
  if (role === "moisturizer") return items.some(isSkincareMoisturizerPlanItem);
  return true;
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
  const fullHaystack = items
    .flatMap((i) => [
      i.treatment,
      i.product,
      i.region,
      i.interest,
      i.notes,
      ...(i.findings ?? []),
    ])
    .filter(Boolean)
    .map((x) => String(x).toLowerCase())
    .join(" ");
  if (!fullHaystack.trim()) return [];

  const specificsHaystack = planSpecificHaystack(items);
  const ordered = orderBlueprintVideosForPlan(items, catalog);

  const matched = ordered.filter((v) => {
    if (!chapterHasRequiredVideoSkincareRole(items, v.requiresSkincareProductRole)) {
      return false;
    }
    const hay = v.matchAgainstPlanSpecificsOnly ? specificsHaystack : fullHaystack;
    if (!hay.trim()) return false;
    return v.matchKeywords.some((kw) => hay.includes(kw.toLowerCase()));
  });
  if (!isJudgeMdReelVideoCatalog(catalog)) return matched;
  const seenTitles = new Set<string>();
  const deduped = matched.filter((video) => {
    const key = video.title.trim().toLowerCase();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });
  return deduped.slice(0, JUDGEMD_CHAPTER_VIDEO_MAX);
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
