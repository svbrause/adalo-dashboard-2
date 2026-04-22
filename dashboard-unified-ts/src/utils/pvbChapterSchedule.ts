import type { DiscussedItem } from "../types";
import {
  canonicalPlanTreatmentName,
  LEGACY_ENERGY_DEVICE_CATEGORY,
  ENERGY_TREATMENT_CATEGORY,
  getTreatmentProductOptionsForProvider,
} from "../components/modals/DiscussedTreatmentsModal/constants";
import {
  getTreatmentDisplayName,
  matchProductTokensToOptionList,
} from "../components/modals/DiscussedTreatmentsModal/utils";

const OTHER_PROCEDURES = "Other procedures";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Normalized chapter key; legacy "Energy Device" rows share the same key as Energy Treatment. */
export function chapterTreatmentNormKey(treatment: string): string {
  const t = treatment.trim();
  if (t === LEGACY_ENERGY_DEVICE_CATEGORY) return norm(ENERGY_TREATMENT_CATEGORY);
  return norm(t);
}

const ENERGY_BASE_KEY = chapterTreatmentNormKey(ENERGY_TREATMENT_CATEGORY);

/** Slug for `other procedures::<slug>` / `energy treatment::<slug>` keys and DOM ids. */
export function slugifyBlueprintProcedureToken(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type BlueprintChapterSlot = {
  key: string;
  /** Canonical treatment category (e.g. "Other procedures") for meta / TREATMENT_META. */
  treatment: string;
  /** Patient-facing section title */
  displayName: string;
};

/**
 * Ordered chapter slots — one per distinct treatment, with **Other procedures** and
 * **Energy Treatment** split into one section per selected procedure / device type when
 * multiple are listed in `product` (e.g. Moxi vs BBL).
 */
export function buildBlueprintChapterSchedule(
  discussedItems: DiscussedItem[],
  providerCode?: string,
): BlueprintChapterSlot[] {
  const otherOpts =
    getTreatmentProductOptionsForProvider(providerCode, OTHER_PROCEDURES) ?? [];
  const energyOpts =
    getTreatmentProductOptionsForProvider(
      providerCode,
      ENERGY_TREATMENT_CATEGORY,
    ) ?? [];
  const seen = new Set<string>();
  const out: BlueprintChapterSlot[] = [];

  for (const item of discussedItems) {
    const t = item.treatment?.trim();
    if (!t) continue;

    if (t === OTHER_PROCEDURES) {
      const raw = (item.product ?? "").trim();
      const { matched, residualParts } = matchProductTokensToOptionList(
        raw,
        otherOpts,
      );

      let segments: (string | null)[];
      if (matched.length > 0) {
        segments = matched;
      } else if (residualParts.length > 0) {
        segments = residualParts;
      } else if (!raw) {
        segments = [null];
      } else {
        segments = [raw];
      }

      for (const seg of segments) {
        const key =
          seg == null
            ? chapterTreatmentNormKey(OTHER_PROCEDURES)
            : `other procedures::${slugifyBlueprintProcedureToken(seg)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          key,
          treatment: OTHER_PROCEDURES,
          displayName: seg ?? OTHER_PROCEDURES,
        });
      }
      continue;
    }

    const isEnergy =
      t === ENERGY_TREATMENT_CATEGORY || t === LEGACY_ENERGY_DEVICE_CATEGORY;
    if (isEnergy) {
      const raw = (item.product ?? "").trim();
      const { matched, residualParts } = matchProductTokensToOptionList(
        raw,
        energyOpts,
      );

      let segments: (string | null)[];
      if (matched.length > 0) {
        segments = matched;
      } else if (residualParts.length > 0) {
        segments = residualParts;
      } else if (!raw) {
        segments = [null];
      } else {
        segments = [raw];
      }

      for (const seg of segments) {
        const key =
          seg == null
            ? ENERGY_BASE_KEY
            : `${ENERGY_BASE_KEY}::${slugifyBlueprintProcedureToken(seg)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          key,
          treatment: ENERGY_TREATMENT_CATEGORY,
          displayName: seg ?? ENERGY_TREATMENT_CATEGORY,
        });
      }
      continue;
    }

    const key = chapterTreatmentNormKey(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      treatment: canonicalPlanTreatmentName(t),
      displayName: getTreatmentDisplayName(item),
    });
  }

  return out;
}

/**
 * Plan rows that belong in a chapter slot (same item may appear in multiple **Other procedures**
 * or **Energy Treatment** sub-chapters).
 */
export function planItemsForBlueprintChapterSlot(
  slot: BlueprintChapterSlot,
  discussedItems: DiscussedItem[],
  providerCode?: string,
): DiscussedItem[] {
  const otherOpts =
    getTreatmentProductOptionsForProvider(providerCode, OTHER_PROCEDURES) ?? [];
  const energyOpts =
    getTreatmentProductOptionsForProvider(
      providerCode,
      ENERGY_TREATMENT_CATEGORY,
    ) ?? [];
  const baseKey = chapterTreatmentNormKey(OTHER_PROCEDURES);

  if (slot.key === ENERGY_BASE_KEY || slot.key.startsWith(`${ENERGY_BASE_KEY}::`)) {
    return discussedItems.filter((i) => {
      const tr = (i.treatment ?? "").trim();
      if (tr !== ENERGY_TREATMENT_CATEGORY && tr !== LEGACY_ENERGY_DEVICE_CATEGORY)
        return false;
      const raw = (i.product ?? "").trim();
      const { matched, residualParts } = matchProductTokensToOptionList(
        raw,
        energyOpts,
      );

      if (slot.key === ENERGY_BASE_KEY) {
        return !raw && matched.length === 0 && residualParts.length === 0;
      }

      const suffix = slot.key.slice(`${ENERGY_BASE_KEY}::`.length);
      const labels =
        matched.length > 0
          ? matched
          : residualParts.length > 0
            ? residualParts
            : raw
              ? [raw]
              : [];
      return labels.some((l) => slugifyBlueprintProcedureToken(l) === suffix);
    });
  }

  if (slot.key !== baseKey && !slot.key.startsWith("other procedures::")) {
    return discussedItems.filter(
      (i) => chapterTreatmentNormKey(i.treatment ?? "") === slot.key,
    );
  }

  return discussedItems.filter((i) => {
    if ((i.treatment ?? "").trim() !== OTHER_PROCEDURES) return false;
    const raw = (i.product ?? "").trim();
    const { matched, residualParts } = matchProductTokensToOptionList(
      raw,
      otherOpts,
    );

    if (slot.key === baseKey) {
      return (
        !raw && matched.length === 0 && residualParts.length === 0
      );
    }

    const suffix = slot.key.slice("other procedures::".length);
    const labels =
      matched.length > 0
        ? matched
        : residualParts.length > 0
          ? residualParts
          : raw
            ? [raw]
            : [];
    return labels.some((l) => slugifyBlueprintProcedureToken(l) === suffix);
  });
}
