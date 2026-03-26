/**
 * Imagery + copy helpers for Wellnest peptide cards in the treatment recommender.
 * Hero images use stable local assets or Unsplash stock (https://unsplash.com/license)
 * and are illustrative only (not clinical outcomes).
 */

import type { WellnestOffering } from "./wellnestOfferings";

const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&w=720&h=480&fit=crop&q=85`;

const WELLNEST_LOCAL_IMAGE_BASE = "/post-visit-blueprint/videos/wellnest";
const wellnestLocal = (filename: string) =>
  `${WELLNEST_LOCAL_IMAGE_BASE}/${filename}`;

/** Fallback when a row has no mapped image */
export const WELLNEST_RECOMMENDER_DEFAULT_IMAGE = wellnestLocal(
  "peptide-bna-2-edit.webp",
);

function nk(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Curated hero per peptide (wellness / lifestyle / science stock — not before-after claims).
 */
const RECOMMENDER_IMAGE_BY_TREATMENT: Record<string, string> = {
  [nk("BPC-157")]: unsplash("photo-1571019613454-1cb2f99b2d8b"),
  [nk("Thymosin Beta-4 (TB-500)")]: unsplash("photo-1544367567-0f2fcb009e0b"),
  [nk("CJC-1295")]: unsplash("photo-1505751172876-fa1923c5c528"),
  // Previous Unsplash id 404'd; use local stable asset.
  [nk("Ipamorelin")]: wellnestLocal("peptide-bna-2-edit.webp"),
  [nk("Semax")]: unsplash("photo-1451187580459-43490279c0fa"),
  [nk("Selank")]: unsplash("photo-1506126613408-eca07ce68773"),
  [nk("P-21")]: unsplash("photo-1551601651-2a8555f1a136"),
  // Previous Unsplash id 404'd; use local stable asset.
  [nk("Pinealon")]: wellnestLocal("02_BA.jpg"),
  // Common misspelling seen in manual entries.
  [nk("Pinaelon")]: wellnestLocal("02_BA.jpg"),
  [nk("GHRP-2 / GHRP-6")]: unsplash("photo-1517836357463-d25dfeac3438"),
  [nk("IGF-1 LR3")]: unsplash("photo-1534438327276-14e5300c3a48"),
  [nk("GHK-Cu")]: unsplash("photo-1616394584738-fc6e612e71b9"),
  [nk("Melanotan 2")]: unsplash("photo-1507525428034-b723cf961d3e"),
  [nk("MK-677")]: unsplash("photo-1518611012118-696072aa579a"),
  [nk("Sermorelin")]: unsplash("photo-1576091160399-112ba8d25d1d"),
  [nk("Tesamorelin")]: unsplash("photo-1576678927484-cc907957088c"),
  [nk("Epitalon")]: unsplash("photo-1490750967868-88aa4486c946"),
  [nk("AOD-9604")]: unsplash("photo-1490645935967-10de6ba17061"),
  [nk("Cartalax")]: unsplash("photo-1544367567-0f2fcb009e0b"),
};

export function getWellnestRecommenderImageUrl(
  treatmentName: string,
): string {
  const key = nk(treatmentName);
  return RECOMMENDER_IMAGE_BY_TREATMENT[key] ?? WELLNEST_RECOMMENDER_DEFAULT_IMAGE;
}

/** Short bullets for “example discussion” / education (from offering copy). */
export function getWellnestExampleTalkingPoints(
  offering: WellnestOffering,
): string[] {
  return offering.addresses
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}
