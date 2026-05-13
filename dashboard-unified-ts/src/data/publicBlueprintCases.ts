import type { DiscussedItem } from "../types";
import type { BlueprintCasePhoto } from "../utils/postVisitBlueprintCases";

const SCULPTRA_BEFORE_AFTER_URL = "https://www.sculptrausa.com/before-after";

const SCULPTRA_CASES: BlueprintCasePhoto[] = [
  {
    id: "public-sculptra-christian-6mo",
    photoUrl:
      "https://www.sculptrausa.com/sites/default/files/2023-09/christian_after_0.png",
    treatments: ["Biostimulants", "Sculptra"],
    areaNames: ["Cheeks", "Face"],
    age: "44",
    caption: "Actual Sculptra patient. Individual results may vary.",
    storyTitle: "Sculptra: broader cheek area",
    storyDetailed:
      "Christian, 44, was treated with 3 vials of Sculptra in the broader cheek area. This image shows the 6-month result from the official Sculptra before-and-after gallery.",
    sourceLabel: "Sculptra official gallery",
    sourceUrl: SCULPTRA_BEFORE_AFTER_URL,
  },
  {
    id: "public-sculptra-gabriela-6mo",
    photoUrl:
      "https://www.sculptrausa.com/sites/default/files/2023-09/gabriela_after_0.png",
    treatments: ["Biostimulants", "Sculptra"],
    areaNames: ["Cheeks", "Face"],
    age: "36",
    caption: "Actual Sculptra patient. Individual results may vary.",
    storyTitle: "Sculptra: cheek collagen support",
    storyDetailed:
      "Gabriela, 36, was treated with 3 vials of Sculptra in the broader cheek area. This image shows the 6-month result from the official Sculptra before-and-after gallery.",
    sourceLabel: "Sculptra official gallery",
    sourceUrl: SCULPTRA_BEFORE_AFTER_URL,
  },
  {
    id: "public-sculptra-giselle-9mo",
    photoUrl:
      "https://www.sculptrausa.com/sites/default/files/2023-10/giselle-9mo.png",
    treatments: ["Biostimulants", "Sculptra"],
    areaNames: ["Nasolabial folds", "Face"],
    age: "43",
    caption: "Actual Sculptra patient. Individual results may vary.",
    storyTitle: "Sculptra: facial wrinkles and folds",
    storyDetailed:
      "Giselle, 43, was treated with 5 vials of Sculptra in the nasolabial folds and other facial wrinkles. This image shows the 9-month result from the official Sculptra before-and-after gallery.",
    sourceLabel: "Sculptra official gallery",
    sourceUrl: SCULPTRA_BEFORE_AFTER_URL,
  },
  {
    id: "public-sculptra-maidelys-9mo",
    photoUrl:
      "https://www.sculptrausa.com/sites/default/files/2023-10/maidelys-9mo.png",
    treatments: ["Biostimulants", "Sculptra"],
    areaNames: ["Nasolabial folds", "Face"],
    age: "38",
    caption: "Actual Sculptra patient. Individual results may vary.",
    storyTitle: "Sculptra: nasolabial folds",
    storyDetailed:
      "Maidelys, 38, was treated with 3 vials of Sculptra in the nasolabial folds. This image shows the 9-month result from the official Sculptra before-and-after gallery.",
    sourceLabel: "Sculptra official gallery",
    sourceUrl: SCULPTRA_BEFORE_AFTER_URL,
  },
];

function planMentionsSculptra(item: DiscussedItem): boolean {
  const text = [item.treatment, item.product, item.brand]
    .map((v) => v?.trim() ?? "")
    .join(" ")
    .toLowerCase();
  return text.includes("sculptra");
}

export function getPublicBlueprintCasesForPlanItems(
  planItems: DiscussedItem[],
): BlueprintCasePhoto[] {
  if (planItems.some(planMentionsSculptra)) return SCULPTRA_CASES;
  return [];
}
