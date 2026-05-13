/**
 * Curated before/after stills from the Judge MD site gallery, for the treatment recommender
 * “view examples” (eye) control. Sourced from public gallery pages (e.g. breast augmentation, labiaplasty).
 * @see https://www.judgemd.com/gallery/
 */

import { JUDGEMD_VAGINAL_REJUVENATION_PLAN_BUILDER_STILL } from "./judgeMdRecommenderPresentation";
import type { TreatmentPhoto } from "../types";

/**
 * Plan cards on which the plan builder shows the “examples” (eye) for Judge MD —
 * gallery before/afters and modal are wired from judgemd.com.
 */
export const JUDGEMD_PLAN_BUILDER_GALLERY_EYE_TREATMENTS: readonly string[] = [
  "Breast Surgery",
  "Body Sculpting",
  "Vaginal Rejuvenation",
  "Facial Surgery",
  "Rhinoplasty",
  "Facial Surgery — Ears",
  "Facial Surgery — Rhinoplasty",
  "Facial Surgery — Eyes & brows",
] as const;

const JUDGEMD_PLAN_BUILDER_GALLERY_EYE_SET = new Set(
  JUDGEMD_PLAN_BUILDER_GALLERY_EYE_TREATMENTS.map((s) => s.toLowerCase()),
);

/** True for the plan-builder cards that have a Judgemd.com gallery + eye affordance. */
export function isJudgeMdPlanBuilderGalleryEyeTreatment(
  treatmentName: string,
): boolean {
  return JUDGEMD_PLAN_BUILDER_GALLERY_EYE_SET.has(treatmentName.trim().toLowerCase());
}

function nk(name: string): string {
  return name.trim().toLowerCase();
}

export type JudgeMdGalleryExhibit = {
  /** Canonical gallery page to attribute and “open full gallery” */
  pageUrl: string;
  imageUrls: readonly string[];
};

const JUDGE_MD_ORIGIN = "https://www.judgemd.com";

function u(path: string): string {
  return path.startsWith("http") ? path : `${JUDGE_MD_ORIGIN}${path}`;
}

const BREAST_AUG_IMAGES: readonly string[] = [
  "/wp-content/uploads/2019/03/breast_aug_lift.jpg",
  "/wp-content/uploads/2019/04/Breast-Aug-.jpg",
  "/wp-content/uploads/2019/04/Breast-Aug.png",
  "/wp-content/uploads/2019/04/Breast-Aug1.jpg",
  "/wp-content/uploads/2019/04/Breast-aug1.png",
  "/wp-content/uploads/2019/04/Breast-aug3.png",
  "/wp-content/uploads/2019/04/breast-aug.jpg",
  "/wp-content/uploads/2019/04/breast-aug4.png",
  "/wp-content/uploads/2019/04/breast-lift-and-aug.jpg",
  "/wp-content/uploads/2019/04/breast_23ab-1.jpg",
  "/wp-content/uploads/2019/04/breast_23ab-2-1.jpg",
  "/wp-content/uploads/2019/04/breast_3ab-1.jpg",
  "/wp-content/uploads/2019/04/breast_3ab-2-1.jpg",
  "/wp-content/uploads/2019/04/breast_6ab-1.jpg",
  "/wp-content/uploads/2019/04/breast_8ab-1.jpg",
].map(u);

/** @see https://www.judgemd.com/gallery/breast-lift/ */
const BREAST_LIFT_GALLERY_IMAGES: readonly string[] = [
  "/wp-content/uploads/2019/03/breast_lift.jpg",
  "/wp-content/uploads/2019/04/breast_15ab-1.jpg",
  "/wp-content/uploads/2019/04/breast_20ab-1.jpg",
].map(u);

/** @see https://www.judgemd.com/gallery/breast-lift-with-augmentation/ */
const BREAST_LIFT_WITH_AUG_GALLERY_IMAGES: readonly string[] = [
  "/wp-content/uploads/2019/03/breast_aug_lift-1.jpg",
  "/wp-content/uploads/2019/04/breast_13ab-1.jpg",
  "/wp-content/uploads/2019/04/breast_13ab-2-1.jpg",
  "/wp-content/uploads/2019/04/breast_14ab-2.jpg",
  "/wp-content/uploads/2019/04/breast_15ab-2-2.jpg",
  "/wp-content/uploads/2019/04/breast_18ab-2.jpg",
  "/wp-content/uploads/2019/04/breast_21ab-2-2.jpg",
  "/wp-content/uploads/2019/04/breast_21ab-3.jpg",
  "/wp-content/uploads/2019/04/breast_22ab-2.jpg",
  "/wp-content/uploads/2019/04/breast_2ab-1.jpg",
  "/wp-content/uploads/2019/04/breast_2ab-2-1.jpg",
  "/wp-content/uploads/2019/04/breast_5ab-2.jpg",
  "/wp-content/uploads/2019/04/breast_9ab-2-2.jpg",
  "/wp-content/uploads/2019/04/breast_9ab-4.jpg",
].map(u);

/** @see https://www.judgemd.com/gallery/breast-reduction/ */
const BREAST_REDUCTION_GALLERY_IMAGES: readonly string[] = [
  "/wp-content/uploads/2019/03/breast_reduction.jpg",
  "/wp-content/uploads/2019/04/breast_11ab-1.jpg",
  "/wp-content/uploads/2019/04/breast_11ab-2-1.jpg",
  "/wp-content/uploads/2019/04/breast_17ab-22.jpg",
  "/wp-content/uploads/2019/04/breast_1ab-1.jpg",
  "/wp-content/uploads/2019/04/breast_22ab-1.jpg",
  "/wp-content/uploads/2019/04/breast_4ab-1.jpg",
  "/wp-content/uploads/2019/04/breast_7ab-1.jpg",
  "/wp-content/uploads/2019/04/breast_7ab-2-1.jpg",
].map(u);

const LABIAPLASTY_IMAGES: readonly string[] = [
  "/wp-content/uploads/2019/03/4892F58D-0A49-4B96-A4BA-E186C40C6535-2.jpg",
  "/wp-content/uploads/2019/03/642714A2-6201-4825-9799-5782DBF45CE7-2.jpg",
].map(u);

const RHINOPLASTY_IMAGES: readonly string[] = [
  "/wp-content/uploads/2019/04/Rhini.jpg",
  "/wp-content/uploads/2019/04/Rhino.jpg",
  "/wp-content/uploads/2019/04/Untitled-design-9.png",
  "/wp-content/uploads/2019/04/face_55_ba-2.jpg",
  "/wp-content/uploads/2019/04/face_55_ba.jpg",
  "/wp-content/uploads/2019/04/face_56_ba-2.jpg",
  "/wp-content/uploads/2019/04/face_56_ba.jpg",
  "/wp-content/uploads/2019/04/face_57_ba-2.jpg",
  "/wp-content/uploads/2019/04/face_57_ba.jpg",
  "/wp-content/uploads/2019/04/face_58_ba-2.jpg",
  "/wp-content/uploads/2019/04/face_58_ba.jpg",
  "/wp-content/uploads/2019/04/face_59_ba.jpg",
  "/wp-content/uploads/2019/04/face_60_ba-2.jpg",
  "/wp-content/uploads/2019/04/face_60_ba.jpg",
  "/wp-content/uploads/2019/04/face_61_ba-2.jpg",
  "/wp-content/uploads/2019/04/face_61_ba.jpg",
  "/wp-content/uploads/2019/04/face_62_ba-2.jpg",
  "/wp-content/uploads/2019/04/face_62_ba.jpg",
  "/wp-content/uploads/2019/04/face_63_ba.jpg",
  "/wp-content/uploads/2019/04/face_64_ba.jpg",
  "/wp-content/uploads/2019/04/rhino.png",
  "/wp-content/uploads/2019/04/rhino1.jpg",
  "/wp-content/uploads/2019/04/rhino1.png",
  "/wp-content/uploads/2019/04/rhino2.png",
].map(u);

const BLEPHAROPLASTY_IMAGES: readonly string[] = [
  "/wp-content/uploads/2019/04/Blepharoplasty.jpg",
  "/wp-content/uploads/2019/04/face_40_ba-2.jpg",
  "/wp-content/uploads/2019/04/face_40_ba.jpg",
  "/wp-content/uploads/2019/04/face_46_ba-2.jpg",
  "/wp-content/uploads/2019/04/face_46_ba.jpg",
  "/wp-content/uploads/2019/04/face_47_ba-2.jpg",
  "/wp-content/uploads/2019/04/face_47_ba.jpg",
  "/wp-content/uploads/2019/04/face_48_ba.jpg",
].map(u);

const FILLERS_GALLERY_IMAGES: readonly string[] = [
  "/wp-content/uploads/2019/03/header_images-1.jpg",
  "/wp-content/uploads/2019/04/Face_Juvederm-Front.jpg",
  "/wp-content/uploads/2019/04/Face_Juvederm-Side.jpg",
  "/wp-content/uploads/2019/04/Face_PT2-Lip.jpg",
  "/wp-content/uploads/2019/04/Face_PT3-Lip.jpg",
  "/wp-content/uploads/2019/04/face_50_ba.jpg",
  "/wp-content/uploads/2019/04/face_52_ba-1.jpg",
].map(u);

const EAR_GALLERY_IMAGES: readonly string[] = [
  "/wp-content/uploads/2019/03/earlobe_otoplasty.jpg",
  "/wp-content/uploads/2019/04/face_42_ba.jpg",
  "/wp-content/uploads/2019/04/face_43_ba.jpg",
  "/wp-content/uploads/2019/04/face_44_ba.jpg",
  "/wp-content/uploads/2019/04/face_45_ba.jpg",
].map(u);

const FACIAL_SURGERY_GALLERY_IMAGES: readonly string[] = [
  ...BLEPHAROPLASTY_IMAGES,
  ...EAR_GALLERY_IMAGES,
  u("/wp-content/uploads/2019/04/face_53_ba-2.jpg"),
  u("/wp-content/uploads/2019/04/face_63_ba.jpg"),
];

/** @see https://www.judgemd.com/gallery/liposuction/ */
const LIPOSUCTION_GALLERY_IMAGES: readonly string[] = [
  "/wp-content/uploads/2019/03/liposuction.jpg",
  "/wp-content/uploads/2019/04/body_26ab-2.jpg",
  "/wp-content/uploads/2019/04/body_26ab-3.jpg",
  "/wp-content/uploads/2019/04/body_26ab.jpg",
  "/wp-content/uploads/2019/04/body_27_ab.jpg",
  "/wp-content/uploads/2019/04/body_2ab.jpg",
  "/wp-content/uploads/2019/04/face_53_ba-2.jpg",
].map(u);

/** @see https://www.judgemd.com/gallery/abdominoplasty/ */
const ABDOMINOPLASTY_GALLERY_IMAGES: readonly string[] = [
  "/wp-content/uploads/2019/03/tummy_tuck.jpg",
  "/wp-content/uploads/2019/04/body_13ab.jpg",
  "/wp-content/uploads/2019/04/body_14ab.jpg",
  "/wp-content/uploads/2019/04/body_15ab.jpg",
  "/wp-content/uploads/2019/04/body_25ab-2.jpg",
  "/wp-content/uploads/2019/04/body_25ab.jpg",
].map(u);

/**
 * Map plan-builder **treatment** name → gallery page + images.
 * @see https://www.judgemd.com/gallery/breast-augmentation/
 * @see https://www.judgemd.com/gallery/breast-lift/
 * @see https://www.judgemd.com/gallery/breast-lift-with-augmentation/
 * @see https://www.judgemd.com/gallery/breast-reduction/
 * @see https://www.judgemd.com/gallery/labiaplasty/
 * @see https://www.judgemd.com/gallery/ear-reshaping-repair/
 * @see https://www.judgemd.com/gallery/rhinoplasty/
 * @see https://www.judgemd.com/gallery/blepharoplasty/
 * @see https://www.judgemd.com/gallery/liposuction/
 * @see https://www.judgemd.com/gallery/abdominoplasty/
 */
const GALLERY_EXHIBIT_BY_TREATMENT: Record<string, JudgeMdGalleryExhibit> = {
  [nk("Vaginal Rejuvenation")]: {
    pageUrl: "https://www.judgemd.com/gallery/labiaplasty/",
    imageUrls: LABIAPLASTY_IMAGES,
  },
  [nk("Facial Surgery")]: {
    pageUrl: "https://www.judgemd.com/gallery/",
    imageUrls: FACIAL_SURGERY_GALLERY_IMAGES,
  },
  [nk("Rhinoplasty")]: {
    pageUrl: "https://www.judgemd.com/gallery/rhinoplasty/",
    imageUrls: RHINOPLASTY_IMAGES,
  },
  [nk("Facial Surgery — Lifting & threads")]: {
    pageUrl: "https://www.judgemd.com/gallery/rhinoplasty/",
    imageUrls: RHINOPLASTY_IMAGES,
  },
  [nk("Facial Surgery — Eyes & brows")]: {
    pageUrl: "https://www.judgemd.com/gallery/blepharoplasty/",
    imageUrls: BLEPHAROPLASTY_IMAGES,
  },
  [nk("Facial Surgery — Rhinoplasty")]: {
    pageUrl: "https://www.judgemd.com/gallery/rhinoplasty/",
    imageUrls: RHINOPLASTY_IMAGES,
  },
  [nk("Facial Surgery — Lips, chin & jaw")]: {
    pageUrl: "https://www.judgemd.com/gallery/fillers/",
    imageUrls: FILLERS_GALLERY_IMAGES,
  },
  [nk("Facial Surgery — Fat transfer")]: {
    pageUrl: "https://www.judgemd.com/gallery/rhinoplasty/",
    imageUrls: [
      u("/wp-content/uploads/2019/04/face_63_ba.jpg"),
      u("/wp-content/uploads/2019/04/face_62_ba.jpg"),
      u("/wp-content/uploads/2019/04/face_61_ba.jpg"),
    ],
  },
  [nk("Facial Surgery — Ears")]: {
    pageUrl: "https://www.judgemd.com/gallery/ear-reshaping-repair/",
    imageUrls: EAR_GALLERY_IMAGES,
  },
  [nk("Facial Surgery — Forehead, hairline & skin")]: {
    pageUrl: "https://www.judgemd.com/gallery/rhinoplasty/",
    imageUrls: RHINOPLASTY_IMAGES,
  },
  [nk("Neurotoxin")]: {
    pageUrl: "https://www.judgemd.com/gallery/fillers/",
    imageUrls: FILLERS_GALLERY_IMAGES,
  },
  [nk("Filler")]: {
    pageUrl: "https://www.judgemd.com/gallery/fillers/",
    imageUrls: FILLERS_GALLERY_IMAGES,
  },
  [nk("Biostimulants")]: {
    pageUrl: "https://www.judgemd.com/gallery/fillers/",
    imageUrls: FILLERS_GALLERY_IMAGES,
  },
  [nk("Other procedures")]: {
    pageUrl: "https://www.judgemd.com/gallery/fillers/",
    imageUrls: FILLERS_GALLERY_IMAGES,
  },
};

/**
 * Optional context from plan rows (`DiscussedItem.product`): breast line item, or body sculpting
 * (abdominoplasty vs liposuction).
 */
export type JudgeMdGalleryExhibitOptions = {
  breastSurgeryProductLine?: string | null;
  /** `DiscussedItem.product` on a “Body Sculpting” row — abdominoplasty vs liposuction gallery. */
  bodySculptingProductLine?: string | null;
};

function resolveJudgeMdBreastSurgeryGalleryExhibit(
  productLine: string | undefined | null,
): JudgeMdGalleryExhibit {
  const p = (productLine ?? "").trim().toLowerCase();
  if (p.includes("lift with augmentation")) {
    return {
      pageUrl: "https://www.judgemd.com/gallery/breast-lift-with-augmentation/",
      imageUrls: BREAST_LIFT_WITH_AUG_GALLERY_IMAGES,
    };
  }
  if (p.includes("breast reduction")) {
    return {
      pageUrl: "https://www.judgemd.com/gallery/breast-reduction/",
      imageUrls: BREAST_REDUCTION_GALLERY_IMAGES,
    };
  }
  if (p.includes("breast lift")) {
    return {
      pageUrl: "https://www.judgemd.com/gallery/breast-lift/",
      imageUrls: BREAST_LIFT_GALLERY_IMAGES,
    };
  }
  return {
    pageUrl: "https://www.judgemd.com/gallery/breast-augmentation/",
    imageUrls: BREAST_AUG_IMAGES,
  };
}

function resolveJudgeMdBodySculptingGalleryExhibit(
  productLine: string | undefined | null,
): JudgeMdGalleryExhibit {
  const p = (productLine ?? "").trim().toLowerCase();
  if (
    p.includes("abdominoplasty") ||
    p.includes("tummy tuck") ||
    p.includes("umbilicoplasty")
  ) {
    return {
      pageUrl: "https://www.judgemd.com/gallery/abdominoplasty/",
      imageUrls: ABDOMINOPLASTY_GALLERY_IMAGES,
    };
  }
  if (p.includes("liposuction") || p.includes("brachioplasty") || p.includes("arm lift")) {
    return {
      pageUrl: "https://www.judgemd.com/gallery/liposuction/",
      imageUrls: LIPOSUCTION_GALLERY_IMAGES,
    };
  }
  return {
    pageUrl: "https://www.judgemd.com/gallery/liposuction/",
    imageUrls: LIPOSUCTION_GALLERY_IMAGES,
  };
}

/**
 * When non-null, the recommender can pass these as {@link TreatmentPhotos} `demoPhotos`
 * and show a link to `pageUrl`.
 */
export function getJudgeMdRecommenderGalleryExhibit(
  treatmentName: string,
  options?: JudgeMdGalleryExhibitOptions,
): JudgeMdGalleryExhibit | null {
  const t = nk(treatmentName);
  if (t === nk("Breast Surgery")) {
    const ex = resolveJudgeMdBreastSurgeryGalleryExhibit(
      options?.breastSurgeryProductLine,
    );
    if (!ex.imageUrls.length) return null;
    return ex;
  }
  if (t === nk("Body Sculpting")) {
    const ex = resolveJudgeMdBodySculptingGalleryExhibit(
      options?.bodySculptingProductLine,
    );
    if (!ex.imageUrls.length) return null;
    return ex;
  }
  const ex = GALLERY_EXHIBIT_BY_TREATMENT[t];
  if (!ex || ex.imageUrls.length === 0) return null;
  if (t === nk("Vaginal Rejuvenation")) {
    const noPlanCard = ex.imageUrls.filter(
      (u) => u !== JUDGEMD_VAGINAL_REJUVENATION_PLAN_BUILDER_STILL,
    );
    if (noPlanCard.length > 0) {
      return { pageUrl: ex.pageUrl, imageUrls: noPlanCard };
    }
  }
  return ex;
}

/**
 * Judge MD gallery pages mix hero / lifestyle JPGs with composite before/after stills.
 * The treatment recommender modal should only show clinical before/afters.
 */
function isJudgeMdUrlLikelyBeforeAfterStill(url: string): boolean {
  const path = url.split(/[?#]/)[0].toLowerCase();
  const file = path.split("/").pop() ?? path;

  if (path.includes("_ba")) return true;
  if (/body_\d+ab/i.test(path)) return true;
  if (/body_\d+_ab\./i.test(path)) return true;
  if (/breast_\d+ab/i.test(path)) return true;

  // Labiaplasty uploads: UUID filenames (no `_ba` in the path).
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-\d+\.(jpg|jpeg|png)$/.test(
      file,
    )
  ) {
    return true;
  }

  return false;
}

function filterJudgeMdGalleryImageUrlsForBeforeAfterStills(
  imageUrls: readonly string[],
): string[] {
  return imageUrls.filter(isJudgeMdUrlLikelyBeforeAfterStill);
}

export function judgeMdExhibitToDemoPhotos(
  treatmentName: string,
  exhibit: JudgeMdGalleryExhibit,
): TreatmentPhoto[] {
  const urls = filterJudgeMdGalleryImageUrlsForBeforeAfterStills(exhibit.imageUrls);
  return urls.map((url, i) => ({
    id: `judgemd-gallery-${nk(treatmentName)}-${i}`,
    name: "",
    photoUrl: url,
    thumbnailUrl: url,
    treatments: [treatmentName],
    generalTreatments: [treatmentName],
    areaNames: [],
  }));
}
