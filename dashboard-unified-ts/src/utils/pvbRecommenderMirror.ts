import { REGION_FILTER_OPTIONS } from "../config/treatmentRecommenderConfig";

const VALID = new Set<string>(REGION_FILTER_OPTIONS);

/**
 * Maps treatment recommender region filter chips to short strings that match
 * {@link AiMirrorCanvas} keyword → face-region logic (substring match on normalized terms).
 */
export function mapRecommenderRegionsToMirrorTerms(
  selected: readonly string[],
): string[] {
  const terms: string[] = [];
  for (const raw of selected) {
    const r = raw.trim();
    if (!r || !VALID.has(r)) continue;
    switch (r) {
      case "Skin/Full face":
        terms.push(
          "forehead",
          "brow",
          "eye",
          "cheek",
          "nose",
          "lip",
          "chin",
          "jaw",
        );
        break;
      case "Forehead/Brows":
        terms.push("forehead", "brow", "frown");
        break;
      case "Eyes":
        terms.push("eye", "crow");
        break;
      case "Cheeks":
        terms.push("cheek", "nasolabial");
        break;
      case "Nose":
        terms.push("nose");
        break;
      case "Lips":
        terms.push("lip", "mouth");
        break;
      case "Jawline":
        terms.push("jaw", "jowl");
        break;
      case "Chin":
        terms.push("chin", "submental");
        break;
      case "Neck":
        terms.push("neck", "jowl");
        break;
      default:
        break;
    }
  }
  return terms;
}
