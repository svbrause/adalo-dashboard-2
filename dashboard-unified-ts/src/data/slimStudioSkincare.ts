/**
 * Slim Studio Face & Body — medical grade skincare catalog and quiz mappings.
 * Aligned with https://slimstudioatlanta.com/medical-grade-skincare/
 * (ISDIN, Hydrinity, and Skinade — professional lines only).
 */

import type { GemstoneId, RoutineStep } from "./skinTypeQuiz";
import type { TreatmentBoutiqueProduct } from "../components/modals/DiscussedTreatmentsModal/treatmentBoutiqueProducts";
import { SLIM_STUDIO_SKINCARE_IMAGES } from "./providerSkincareImages";

const SKINCARE_PAGE =
  "https://slimstudioatlanta.com/medical-grade-skincare/";

/** Canonical product names (match quiz routines + plan builder dropdown). */
export const SLIM_STUDIO_SKINCARE_PRODUCT_NAMES = {
  isdinMelatonik:
    "ISDIN Melatonik Night Serum | Overnight antioxidant serum for repair and renewal",
  isdinActinica:
    "ISDIN Eryfotona Actinica SPF 50+ | Lightweight mineral sunscreen for daily protection and repair",
  isdinAgeless:
    "ISDIN Eryfotona Ageless Tinted SPF 50+ | Tinted mineral sunscreen with photoaging support",
  isdinRetinol:
    "ISDIN Retinol Advanced | Gentle retinol for smoother texture and renewal",
  isdinMelaclear:
    "ISDIN Melaclear Advanced | Brightening serum for dark spots and uneven tone",
  isdinAgeContourDay:
    "ISDIN Age Contour Day Cream | Firming daytime moisturizer",
  isdinAgeContourNight:
    "ISDIN Age Contour Night Cream | Restorative nighttime moisturizer",
  isdinHyaluronic:
    "ISDIN Hyaluronic Concentrate | Hydrating gel-serum for plump, supple skin",
  isdinVitalEyes:
    "ISDIN Vital Eyes | Eye cream for puffiness, fine lines, and fatigue",
  hydrinityHaSerum:
    "Hydrinity Restorative HA Serum | Daily hyaluronic serum for hydration and calm",
  hydrinityMasque:
    "Hydrinity HA+ Masque | Gel mask for instant hydration and glow",
  hydrinityHyacin:
    "Hydrinity HYACIN Active Purifying Mist | Calming mist for breakout-prone or stressed skin",
  hydrinityVivid:
    "Hydrinity VIVID Brightening Serum | Targets dullness, discoloration, and uneven tone",
  hydrinityEncore:
    "Hydrinity ENCORE Body Hydrator | Nourishing body moisturizer for dry or depleted skin",
  hydrinityKit:
    "Hydrinity Restorative Kit | HA serum + HYACIN mist two-step hydration system",
  skinade:
    "Skinade Collagen Drink | Daily liquid collagen supplement for skin quality from within",
} as const;

export type SlimStudioSkincareProductName =
  (typeof SLIM_STUDIO_SKINCARE_PRODUCT_NAMES)[keyof typeof SLIM_STUDIO_SKINCARE_PRODUCT_NAMES];

type SlimStudioSkincareImageKey = keyof typeof SLIM_STUDIO_SKINCARE_IMAGES;

function productRow(
  imageKey: SlimStudioSkincareImageKey,
  name: SlimStudioSkincareProductName,
  productUrl = SKINCARE_PAGE,
): TreatmentBoutiqueProduct {
  return {
    name,
    productUrl,
    imageUrl: SLIM_STUDIO_SKINCARE_IMAGES[imageKey],
  };
}

const N = SLIM_STUDIO_SKINCARE_PRODUCT_NAMES;

/** Carousel / boutique rows for Slim Studio medical-grade skincare. */
export const SLIM_STUDIO_SKINCARE_CAROUSEL: TreatmentBoutiqueProduct[] = [
  productRow("isdinActinica", N.isdinActinica),
  productRow("isdinAgeless", N.isdinAgeless),
  productRow("isdinMelatonik", N.isdinMelatonik),
  productRow("isdinRetinol", N.isdinRetinol),
  productRow("isdinMelaclear", N.isdinMelaclear),
  productRow("isdinHyaluronic", N.isdinHyaluronic),
  productRow("isdinAgeContourDay", N.isdinAgeContourDay),
  productRow("isdinAgeContourNight", N.isdinAgeContourNight),
  productRow("isdinVitalEyes", N.isdinVitalEyes),
  productRow("hydrinityHaSerum", N.hydrinityHaSerum),
  productRow("hydrinityMasque", N.hydrinityMasque),
  productRow("hydrinityHyacin", N.hydrinityHyacin),
  productRow("hydrinityVivid", N.hydrinityVivid),
  productRow("hydrinityEncore", N.hydrinityEncore),
  productRow("hydrinityKit", N.hydrinityKit),
  productRow("skinade", N.skinade),
];

export const SLIM_STUDIO_RECOMMENDED_PRODUCT_REASONS: Record<string, string> = {
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.isdinActinica]:
    "Daily mineral UV protection",
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.isdinAgeless]:
    "Tinted sun protection with even-tone support",
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.isdinMelatonik]:
    "Overnight antioxidant repair",
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.isdinRetinol]:
    "Gradual renewal and fine-line support",
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.isdinMelaclear]:
    "Dark spots and uneven tone",
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.isdinHyaluronic]:
    "Lightweight hydration and plumping",
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.isdinAgeContourDay]:
    "Daytime firmness and moisture",
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.isdinAgeContourNight]:
    "Nighttime recovery and hydration",
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.isdinVitalEyes]:
    "Under-eye puffiness and fine lines",
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.hydrinityHaSerum]:
    "Deep hydration and barrier support",
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.hydrinityMasque]:
    "Instant hydration boost",
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.hydrinityHyacin]:
    "Calm redness and congestion",
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.hydrinityVivid]:
    "Brightening and even tone",
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.hydrinityEncore]:
    "Body hydration and nourishment",
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.hydrinityKit]:
    "Simple two-step hydration routine",
  [SLIM_STUDIO_SKINCARE_PRODUCT_NAMES.skinade]:
    "Collagen support from within",
};

const P = SLIM_STUDIO_SKINCARE_PRODUCT_NAMES;

function step(label: string, ...productNames: SlimStudioSkincareProductName[]): RoutineStep {
  return { label, productNames: [...productNames] };
}

/** AM/PM routines using ISDIN + Hydrinity (+ Skinade optional) per gemstone type. */
export const SLIM_STUDIO_ROUTINE_NOTES_BY_SKIN_TYPE: Record<
  GemstoneId,
  { am: RoutineStep[]; pm: RoutineStep[]; optional?: { label: string; productNames: string[] } }
> = {
  opal: {
    am: [
      step("HYACIN Active Purifying Mist (calm reactive, breakout-prone skin)", P.hydrinityHyacin),
      step("VIVID Brightening Serum (uneven tone and pigment)", P.hydrinityVivid),
      step("Melaclear Advanced (target hyperpigmentation)", P.isdinMelaclear),
      step("Eryfotona Actinica SPF 50+ (daily protection)", P.isdinActinica),
    ],
    pm: [
      step("Melatonik Night Serum (overnight repair)", P.isdinMelatonik),
      step("Retinol Advanced — introduce slowly if tolerated", P.isdinRetinol),
      step("Restorative HA Serum (barrier hydration)", P.hydrinityHaSerum),
      step("Vital Eyes (periorbital support)", P.isdinVitalEyes),
    ],
  },
  pearl: {
    am: [
      step("HYACIN Active Purifying Mist", P.hydrinityHyacin),
      step("Restorative HA Serum", P.hydrinityHaSerum),
      step("Eryfotona Actinica SPF 50+", P.isdinActinica),
    ],
    pm: [
      step("Melatonik Night Serum", P.isdinMelatonik),
      step("Restorative HA Serum", P.hydrinityHaSerum),
      step("Age Contour Night Cream", P.isdinAgeContourNight),
    ],
  },
  jade: {
    am: [
      step("VIVID Brightening Serum", P.hydrinityVivid),
      step("Melaclear Advanced", P.isdinMelaclear),
      step("Eryfotona Ageless Tinted SPF 50+", P.isdinAgeless),
    ],
    pm: [
      step("Retinol Advanced", P.isdinRetinol),
      step("Restorative HA Serum", P.hydrinityHaSerum),
      step("Melaclear Advanced (continue pigment care)", P.isdinMelaclear),
    ],
    optional: {
      label: "HA+ Masque 1–2×/week for extra glow",
      productNames: [P.hydrinityMasque],
    },
  },
  quartz: {
    am: [
      step("Restorative HA Serum", P.hydrinityHaSerum),
      step("Hyaluronic Concentrate (optional extra hydration)", P.isdinHyaluronic),
      step("Eryfotona Actinica SPF 50+", P.isdinActinica),
    ],
    pm: [
      step("Retinol Advanced", P.isdinRetinol),
      step("Age Contour Night Cream", P.isdinAgeContourNight),
    ],
    optional: {
      label: "Skinade daily for collagen and skin quality support",
      productNames: [P.skinade],
    },
  },
  amber: {
    am: [
      step("Restorative HA Serum (gentle hydration)", P.hydrinityHaSerum),
      step("Melaclear Advanced (pigment correction)", P.isdinMelaclear),
      step("Eryfotona Actinica SPF 50+", P.isdinActinica),
    ],
    pm: [
      step("Melatonik Night Serum", P.isdinMelatonik),
      step("Hyaluronic Concentrate", P.isdinHyaluronic),
      step("Age Contour Night Cream", P.isdinAgeContourNight),
      step("Vital Eyes", P.isdinVitalEyes),
    ],
  },
  moonstone: {
    am: [
      step("Restorative HA Serum", P.hydrinityHaSerum),
      step("Hyaluronic Concentrate", P.isdinHyaluronic),
      step("Eryfotona Actinica SPF 50+", P.isdinActinica),
    ],
    pm: [
      step("Melatonik Night Serum", P.isdinMelatonik),
      step("Age Contour Night Cream", P.isdinAgeContourNight),
    ],
    optional: {
      label: "HA+ Masque 1–2×/week for extra comfort and hydration",
      productNames: [P.hydrinityMasque],
    },
  },
  turquoise: {
    am: [
      step("VIVID Brightening Serum", P.hydrinityVivid),
      step("Melaclear Advanced", P.isdinMelaclear),
      step("Eryfotona Ageless Tinted SPF 50+", P.isdinAgeless),
    ],
    pm: [
      step("Retinol Advanced", P.isdinRetinol),
      step("Restorative HA Serum", P.hydrinityHaSerum),
      step("Age Contour Day & Night — night focus", P.isdinAgeContourNight),
    ],
  },
  diamond: {
    am: [
      step("Hyaluronic Concentrate", P.isdinHyaluronic),
      step("Age Contour Day Cream", P.isdinAgeContourDay),
      step("Eryfotona Actinica SPF 50+", P.isdinActinica),
    ],
    pm: [
      step("Retinol Advanced", P.isdinRetinol),
      step("Melatonik Night Serum", P.isdinMelatonik),
      step("Age Contour Night Cream", P.isdinAgeContourNight),
    ],
    optional: {
      label: "Skinade for long-term collagen and firmness support",
      productNames: [P.skinade],
    },
  },
};

function uniqueFromRoutine(
  gemstone: GemstoneId,
): SlimStudioSkincareProductName[] {
  const routine = SLIM_STUDIO_ROUTINE_NOTES_BY_SKIN_TYPE[gemstone];
  const names: string[] = [];
  const seen = new Set<string>();
  const add = (n: string) => {
    if (!seen.has(n)) {
      seen.add(n);
      names.push(n);
    }
  };
  for (const s of [...routine.am, ...routine.pm]) {
    for (const n of s.productNames) add(n);
  }
  if (routine.optional) {
    for (const n of routine.optional.productNames) add(n);
  }
  return names as SlimStudioSkincareProductName[];
}

export const SLIM_STUDIO_SKIN_TYPE_TO_PRODUCTS: Record<GemstoneId, string[]> = {
  opal: uniqueFromRoutine("opal"),
  pearl: uniqueFromRoutine("pearl"),
  jade: uniqueFromRoutine("jade"),
  quartz: uniqueFromRoutine("quartz"),
  amber: uniqueFromRoutine("amber"),
  moonstone: uniqueFromRoutine("moonstone"),
  turquoise: uniqueFromRoutine("turquoise"),
  diamond: uniqueFromRoutine("diamond"),
};

/** In-office treatment ideas aligned with Slim Studio services (not SkinCeuticals-era list). */
export const SLIM_STUDIO_TREATMENT_RECOMMENDATIONS_BY_SKIN_TYPE: Record<
  GemstoneId,
  { heading: string; items: string[] }
> = {
  opal: {
    heading: "Reactive skin with pigment — gentle in-office support",
    items: [
      "Glacial — Calm redness and support clarity between visits",
      "Morpheus8 — Texture, tone, and collagen when your provider agrees you're ready",
      "Medical grade facial — Custom calming and brightening steps",
      "Radiesse or Sculptra — Gradual quality and structure when appropriate",
    ],
  },
  pearl: {
    heading: "Sensitive, reactive skin — low-irritation options",
    items: [
      "Glacial — Soothing cryomodulation facial",
      "Facials — Custom medical grade facial for barrier support",
      "Morpheus8 — Collagen and texture when tolerated",
      "Neurotoxin or filler — Targeted refinement with your injector",
    ],
  },
  jade: {
    heading: "Pigment and sun damage with tolerant skin",
    items: [
      "Morpheus8 — Resurfacing, tone, and collagen renewal",
      "Glacial — Brightening and calming maintenance",
      "Sculptra — Long-term collagen and glow",
      "Medical grade facial — Pigment-focused professional care",
    ],
  },
  quartz: {
    heading: "Clear, resilient skin — maintenance and prevention",
    items: [
      "Morpheus8 — Keep texture and collagen strong",
      "Glacial — Refresh and maintain clarity",
      "Neurotoxin or filler — Expression and contour as goals evolve",
      "Sculptra — Structural support and skin quality over time",
    ],
  },
  amber: {
    heading: "Dry, sensitive skin with discoloration",
    items: [
      "Glacial — Gentle brightening without harsh downtime",
      "Morpheus8 — Texture and pigment when your barrier is ready",
      "Medical grade facial — Hydrating, pigment-aware protocol",
      "Sculptra — Gradual firmness and luminosity",
    ],
  },
  moonstone: {
    heading: "Delicate, dry skin — nurturing professional care",
    items: [
      "Medical grade facial — Hydration-first protocol",
      "Glacial — Calming, cooling support",
      "Morpheus8 — Collagen when appropriate",
      "Skinade — Often paired for internal hydration and elasticity support",
    ],
  },
  turquoise: {
    heading: "Pigment and early aging with tolerant skin",
    items: [
      "Morpheus8 — Tone, texture, and collagen",
      "Glacial — Maintenance between deeper treatments",
      "Sculptra or Radiesse — Volume and quality support",
      "Medical grade facial — Brightening and renewal",
    ],
  },
  diamond: {
    heading: "Resilient, aging skin — full rejuvenation plan",
    items: [
      "Morpheus8 — Firmness, texture, and renewal",
      "Sculptra — Collagen regeneration over time",
      "Neurotoxin and filler — Expression and volume refinement",
      "Glacial — Glow and maintenance between visits",
    ],
  },
};

/** Short label for plan builder (matches quiz "Add to plan" display names). */
export function slimStudioSkincareShortName(fullName: string): string {
  return fullName.split("|")[0]?.trim() ?? fullName;
}

const S = slimStudioSkincareShortName;

/** Keyword-matched skincare suggestions in the treatment recommender (Slim Studio catalog). */
export const SLIM_STUDIO_RECOMMENDED_PRODUCTS_BY_CONTEXT: {
  treatment: string;
  keywords: string[];
  products: string[];
}[] = [
  {
    treatment: "Skincare",
    keywords: ["hydrate", "dry", "moisturize", "barrier", "dehydrat"],
    products: [
      S(P.hydrinityHaSerum),
      S(P.isdinHyaluronic),
      S(P.isdinAgeContourNight),
      S(P.hydrinityEncore),
    ],
  },
  {
    treatment: "Skincare",
    keywords: ["oil", "acne", "breakout", "congest", "pore"],
    products: [S(P.hydrinityHyacin), S(P.hydrinityVivid)],
  },
  {
    treatment: "Skincare",
    keywords: ["pigment", "spot", "melasma", "sun", "tone", "bright"],
    products: [
      S(P.isdinMelaclear),
      S(P.hydrinityVivid),
      S(P.isdinActinica),
      S(P.isdinAgeless),
    ],
  },
  {
    treatment: "Skincare",
    keywords: ["red", "sensitive", "rosacea", "irritat"],
    products: [S(P.hydrinityHyacin), S(P.hydrinityHaSerum), S(P.isdinMelatonik)],
  },
  {
    treatment: "Skincare",
    keywords: ["wrinkle", "line", "aging", "firm", "retinol"],
    products: [
      S(P.isdinRetinol),
      S(P.isdinMelatonik),
      S(P.isdinAgeContourDay),
      S(P.isdinAgeContourNight),
      S(P.skinade),
    ],
  },
  {
    treatment: "Skincare",
    keywords: ["eye", "puff", "dark circle"],
    products: [S(P.isdinVitalEyes)],
  },
  {
    treatment: "Skincare",
    keywords: ["spf", "sun", "uv"],
    products: [S(P.isdinActinica), S(P.isdinAgeless)],
  },
  {
    treatment: "Skincare",
    keywords: ["body", "neck", "décolletage", "decolletage"],
    products: [S(P.hydrinityEncore)],
  },
  {
    treatment: "Skincare",
    keywords: ["collagen", "elastic", "weight", "glp"],
    products: [S(P.skinade), S(P.hydrinityHaSerum)],
  },
];

/** Plan builder / checkout product dropdown for Skincare category. */
export const SLIM_STUDIO_SKINCARE_PLAN_PRODUCTS: readonly string[] =
  SLIM_STUDIO_SKINCARE_CAROUSEL.map((p) => slimStudioSkincareShortName(p.name));
