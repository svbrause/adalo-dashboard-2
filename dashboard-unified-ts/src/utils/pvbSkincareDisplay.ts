import { getSkincareCarouselItems } from "../components/modals/DiscussedTreatmentsModal/constants";

/**
 * Keyword-based mapping: if a skincare product name matches any of the `productKeywords`,
 * it's a good post-care add-on for any plan treatment matching `treatmentPatterns`.
 */
const SKINCARE_POST_CARE_MAP: Array<{
  productKeywords: string[];
  treatmentPatterns: string[];
}> = [
  {
    productKeywords: ["phyto corrective", "sensiderm", "sensitive", "redness", "soothing"],
    treatmentPatterns: ["laser", "energy", "microneedling", "peel", "prfm", "ez gel", "sculptra"],
  },
  {
    productKeywords: ["triple lipid", "ceramide", "barrier"],
    treatmentPatterns: ["laser", "energy", "microneedling", "peel", "filler"],
  },
  {
    productKeywords: ["c e ferulic", "phloretin", "serum 10 aox", "antioxidant"],
    treatmentPatterns: ["laser", "energy", "microneedling", "peel"],
  },
  {
    productKeywords: ["discoloration defense", "pigment", "brightening", "dark spot"],
    treatmentPatterns: ["laser", "energy", "peel", "microneedling"],
  },
  {
    productKeywords: ["spf", "sunscreen", "daily protect", "broad spectrum"],
    treatmentPatterns: ["laser", "energy", "peel", "microneedling", "filler", "neurotoxin"],
  },
  {
    productKeywords: ["hydrating b5", "hyaluronic acid intensifier", "hydration"],
    treatmentPatterns: ["filler", "laser", "microneedling", "energy"],
  },
  {
    productKeywords: ["gentle cleanser", "cleansing milk", "cleanser"],
    treatmentPatterns: ["laser", "energy", "microneedling", "filler", "peel"],
  },
  {
    productKeywords: ["silisilk", "biocorneum", "epi-derm", "silicone scar"],
    treatmentPatterns: ["breast surgery", "body sculpting"],
  },
];

/**
 * Returns the display names of plan treatments that this skincare product is post-care for.
 * planTreatments: canonical treatment names present in the patient's plan (e.g. ["Neurotoxin", "Energy Treatment"]).
 */
export function getSkincarePostCareLinks(
  productName: string,
  planTreatments: string[],
): string[] {
  const pLower = productName.trim().toLowerCase();
  const matched = new Set<string>();
  for (const rule of SKINCARE_POST_CARE_MAP) {
    if (!rule.productKeywords.some((kw) => pLower.includes(kw))) continue;
    for (const t of planTreatments) {
      const tLower = t.trim().toLowerCase();
      if (rule.treatmentPatterns.some((pat) => tLower.includes(pat))) {
        matched.add(t);
      }
    }
  }
  return Array.from(matched);
}

function matchSkincareProductName(
  productName: string,
  carouselItems: ReturnType<typeof getSkincareCarouselItems>,
): (ReturnType<typeof getSkincareCarouselItems>[number]) | null {
  const q = (productName ?? "").trim().toLowerCase();
  if (!q) return null;
  const exact = carouselItems.find((p) => p.name.trim().toLowerCase() === q);
  if (exact) return exact;
  return (
    carouselItems.find(
      (p) =>
        p.name.trim().toLowerCase().includes(q) ||
        q.includes(p.name.trim().toLowerCase()),
    ) ?? null
  );
}

/**
 * Patient-facing label: strip marketing subtitles and accidental multi-product glue.
 * Handles pipe titles, en/em dash taglines, comma-joined duplicates, and ASCII hyphens.
 */
export function patientFacingSkincareShortName(fullName: string): string {
  let s = fullName.trim();
  if (!s) return s;

  // Two+ products pasted together (e.g. "Product A, The Treatment Product B …")
  if (
    s.length > 90 &&
    /,\s*(The Treatment|SkinCeuticals|GM Collin|VitaMedica|BIOCORNEUM|Biodermis)\b/i.test(
      s,
    )
  ) {
    s = s.split(",")[0].trim();
  }

  // "Primary | Secondary marketing line"
  const pipeSpaced = s.indexOf(" | ");
  if (pipeSpaced !== -1) s = s.slice(0, pipeSpaced).trim();
  else {
    const pipe = s.indexOf("|");
    if (pipe !== -1 && pipe > 0 && !/^https?:/i.test(s)) {
      s = s.slice(0, pipe).trim();
    }
  }

  // Drop marketing tagline after en dash or em dash (avoid ASCII " - " — can break legitimate names)
  const dashCut = (t: string): string => {
    let u = t;
    for (const sep of ["\u2014", "\u2013", " – ", " — "]) {
      const i = u.indexOf(sep);
      if (i >= 10) {
        u = u.slice(0, i).trim();
        break;
      }
    }
    return u;
  };
  s = dashCut(s);
  s = dashCut(s);

  // Optional brand prefix trim for ultra-long lines (keep last segment if "The Treatment X")
  const maxLen = 56;
  if (s.length > maxLen) {
    const snip = s.slice(0, maxLen - 1).trimEnd();
    const lastSpace = snip.lastIndexOf(" ");
    s =
      lastSpace > 28 ? `${snip.slice(0, lastSpace)}…` : `${snip}…`;
  }

  return s.trim();
}

export type PvbSkincareProductSlot = {
  planProductLabel: string;
  shortName: string;
  imageUrl?: string;
  productUrl?: string;
  addOnForTreatments?: string[];
};

function canonicalSkincareDedupKey(
  raw: string,
  matchedName: string | undefined,
  shortName: string,
): string {
  const source = (matchedName ?? shortName ?? raw).trim().toLowerCase();
  return source
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Distinct skincare products from plan rows, in first-seen order, with boutique image when known. */
export function buildSkincareChapterProductSlots(
  planItems: {
    product?: string | null;
    skincareAddOnForTreatment?: string | null;
  }[],
): PvbSkincareProductSlot[] {
  const carouselItems = getSkincareCarouselItems();
  const byKey = new Map<string, PvbSkincareProductSlot>();
  const out: PvbSkincareProductSlot[] = [];
  for (const item of planItems) {
    const raw = item.product?.trim();
    if (!raw || raw.toLowerCase() === "other") continue;
    const matched = matchSkincareProductName(raw, carouselItems);
    const shortName = patientFacingSkincareShortName(matched?.name ?? raw);
    const key = canonicalSkincareDedupKey(raw, matched?.name, shortName);
    const source = item.skincareAddOnForTreatment?.trim();
    const existing = byKey.get(key);
    if (existing) {
      if (
        source &&
        !existing.addOnForTreatments?.some(
          (t) => t.toLowerCase() === source.toLowerCase(),
        )
      ) {
        existing.addOnForTreatments = [
          ...(existing.addOnForTreatments ?? []),
          source,
        ];
      }
      continue;
    }
    const slot: PvbSkincareProductSlot = {
      planProductLabel: raw,
      shortName,
      imageUrl: matched?.imageUrl,
      productUrl: matched?.productUrl,
      addOnForTreatments: source ? [source] : undefined,
    };
    byKey.set(key, slot);
    out.push(slot);
  }
  return out;
}

/** Shorten chip text when it matches or clearly looks like a boutique skincare product name. */
export function patientFacingSkincarePlanChipLabel(
  highlight: string,
): string {
  const carouselItems = getSkincareCarouselItems();
  const matched = matchSkincareProductName(highlight, carouselItems);
  if (matched) return patientFacingSkincareShortName(matched.name);
  if (highlight.includes(" | ") || highlight.includes("\u2013") || highlight.includes("\u2014")) {
    return patientFacingSkincareShortName(highlight);
  }
  return highlight;
}
