import { getSkincareCarouselItems } from "../components/modals/DiscussedTreatmentsModal/constants";

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
  if (s.length > 90 && /,\s*(The Treatment|SkinCeuticals|GM Collin)\b/i.test(s)) {
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
  planItems: { product?: string | null }[],
): PvbSkincareProductSlot[] {
  const carouselItems = getSkincareCarouselItems();
  const seen = new Set<string>();
  const out: PvbSkincareProductSlot[] = [];
  for (const item of planItems) {
    const raw = item.product?.trim();
    if (!raw || raw.toLowerCase() === "other") continue;
    const matched = matchSkincareProductName(raw, carouselItems);
    const shortName = patientFacingSkincareShortName(matched?.name ?? raw);
    const key = canonicalSkincareDedupKey(raw, matched?.name, shortName);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      planProductLabel: raw,
      shortName,
      imageUrl: matched?.imageUrl,
      productUrl: matched?.productUrl,
    });
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
