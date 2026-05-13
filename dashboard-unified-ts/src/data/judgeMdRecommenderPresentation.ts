/**
 * Judge MD — hero imagery for the treatment recommender, sourced from the practice
 * [photo gallery](https://www.judgemd.com/gallery/) (wp-content uploads). Used only when
 * {@link isJudgeMdProviderCode} matches; illustrative / marketing assets on their site.
 */

function nk(name: string): string {
  return name.trim().toLowerCase();
}

/** Default hero when no row-specific mapping exists. */
export const JUDGEMD_RECOMMENDER_DEFAULT_IMAGE =
  "https://www.judgemd.com/wp-content/uploads/2019/04/rhinoplasty.jpg";

/**
 * Marketing still for the Vaginal Rejuvenation plan card only — not used in the “view examples” gallery.
 * (Gallery cases come from the labiaplasty page; the card uses a non-clinical stock like other surgery categories.)
 */
export const JUDGEMD_VAGINAL_REJUVENATION_PLAN_BUILDER_STILL =
  "https://www.judgemd.com/wp-content/uploads/2019/03/header_images-1.jpg";

/**
 * Curated gallery still (before/after or category hero) per plan-builder card.
 * URLs verified from judgemd.com gallery pages (Rhino, Bleph, Breast, Body, Fillers, etc.).
 */
const RECOMMENDER_IMAGE_BY_TREATMENT: Record<string, string> = {
  [nk("Breast Surgery")]:
    "https://www.judgemd.com/wp-content/uploads/2019/03/breast_aug_lift.jpg",
  [nk("Facial Surgery")]:
    "https://www.judgemd.com/wp-content/uploads/2019/04/Blepharoplasty.jpg",
  [nk("Rhinoplasty")]:
    "https://www.judgemd.com/wp-content/uploads/2019/04/Rhini.jpg",
  [nk("Facial Surgery — Lifting & threads")]:
    "https://www.judgemd.com/wp-content/uploads/2019/04/face_55_ba.jpg",
  [nk("Facial Surgery — Eyes & brows")]:
    "https://www.judgemd.com/wp-content/uploads/2019/04/Blepharoplasty.jpg",
  [nk("Facial Surgery — Rhinoplasty")]:
    "https://www.judgemd.com/wp-content/uploads/2019/04/Rhini.jpg",
  [nk("Facial Surgery — Lips, chin & jaw")]:
    "https://www.judgemd.com/wp-content/uploads/2019/04/Face_Juvederm-Front.jpg",
  [nk("Facial Surgery — Fat transfer")]:
    "https://www.judgemd.com/wp-content/uploads/2019/04/face_63_ba.jpg",
  [nk("Facial Surgery — Ears")]:
    "https://www.judgemd.com/wp-content/uploads/2019/03/earlobe_otoplasty.jpg",
  [nk("Facial Surgery — Forehead, hairline & skin")]:
    "https://www.judgemd.com/wp-content/uploads/2019/04/Untitled-design-9.png",
  [nk("Body Sculpting")]:
    "https://www.judgemd.com/wp-content/uploads/2019/03/tummy_tuck.jpg",
  [nk("Vaginal Rejuvenation")]: JUDGEMD_VAGINAL_REJUVENATION_PLAN_BUILDER_STILL,
  [nk("Neurotoxin")]:
    "https://www.judgemd.com/wp-content/uploads/2019/04/face_40_ba.jpg",
  [nk("Filler")]:
    "https://www.judgemd.com/wp-content/uploads/2019/04/Face_Juvederm-Front.jpg",
  /** Distinct from {@link JUDGEMD_VAGINAL_REJUVENATION_PLAN_BUILDER_STILL} (`header_images-1`). */
  [nk("Biostimulants")]:
    "https://www.judgemd.com/wp-content/uploads/2019/04/Face_Juvederm-Side.jpg",
  [nk("Other procedures")]:
    "https://www.judgemd.com/wp-content/uploads/2019/04/Face_PT2-Lip.jpg",
};

export function getJudgeMdRecommenderImageUrl(treatmentName: string): string {
  const key = nk(treatmentName);
  return RECOMMENDER_IMAGE_BY_TREATMENT[key] ?? JUDGEMD_RECOMMENDER_DEFAULT_IMAGE;
}
