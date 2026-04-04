/**
 * Patient-facing glossary for abbreviations and modalities that appear in plans, SKUs, or overview copy.
 * Matched against combined plan text (discussed items + quote labels + overview narrative).
 */

import type { DiscussedItem } from "../types";

export type PlanGlossaryContext = {
  hasMicroneedling: boolean;
  hasChemicalPeel: boolean;
  hasEnergyTreatment: boolean;
  hasNeurotoxin: boolean;
  hasFiller: boolean;
  hasBiostimulants: boolean;
  hasSkincare: boolean;
  hasPrpFamily: boolean;
};

export function buildPlanGlossaryContext(items: DiscussedItem[]): PlanGlossaryContext {
  const t = new Set(
    items.map((i) => (i.treatment ?? "").trim()).filter(Boolean),
  );
  const blob = items
    .flatMap((i) => [
      i.treatment,
      i.product,
      i.region,
      i.notes,
      i.interest,
      ...(i.findings ?? []),
    ])
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const prpFamily =
    /\bprp\b|\bprfm\b|\bpdgf\b|platelet|fibrin matrix/i.test(blob);

  return {
    hasMicroneedling: t.has("Microneedling"),
    hasChemicalPeel: t.has("Chemical Peel"),
    hasEnergyTreatment:
      t.has("Energy Treatment") || t.has("Energy Device"),
    hasNeurotoxin: t.has("Neurotoxin"),
    hasFiller: t.has("Filler"),
    hasBiostimulants: t.has("Biostimulants"),
    hasSkincare: t.has("Skincare"),
    hasPrpFamily: prpFamily || t.has("PRP") || t.has("PDGF"),
  };
}

export type PvbGlossaryTermDef = {
  id: string;
  /** Any pattern matching plan/overview text surfaces this entry */
  match: RegExp[];
  /**
   * Where to show this definition (normalized treatment keys, same as TreatmentChapter.key).
   * Terms render inside that treatment’s chapter—not in the top overview.
   */
  chapterKeys: string[];
  title: string;
  /** Plain-language definition */
  body: string;
  /**
   * Optional: how this may relate to *this* patient when we know plan context.
   * Return null to omit (caller may still show definition only).
   */
  relationToYou?: (ctx: PlanGlossaryContext) => string | null;
};

export const PVB_PLAN_TERM_GLOSSARY: PvbGlossaryTermDef[] = [
  {
    id: "tca",
    match: [/\bTCA\b/i, /\btrichloroacetic\b/i],
    chapterKeys: ["microneedling", "chemical peel"],
    title: "TCA (trichloroacetic acid)",
    body: "A medium-to-deep peel acid used to improve texture, fine lines, and sun damage by exfoliating damaged layers and stimulating renewal.",
    relationToYou: (ctx) => {
      if (ctx.hasChemicalPeel)
        return "In your plan, TCA describes the peel chemistry your team chose to match your skin and the improvements you discussed.";
      if (ctx.hasMicroneedling)
        return "If TCA is paired with microneedling in your notes, it usually refers to a topical or blended protocol—your provider can confirm what was used at your visit.";
      return null;
    },
  },
  {
    id: "prp",
    match: [/\bPRP\b/i, /\bplatelet[- ]rich plasma\b/i],
    chapterKeys: ["microneedling", "prp"],
    title: "PRP (platelet-rich plasma)",
    body: "A concentrate of your own blood platelets, rich in growth factors that can support healing, collagen, and quality when applied to skin or scalp.",
    relationToYou: (ctx) => {
      if (ctx.hasMicroneedling && ctx.hasPrpFamily)
        return "In your plan, PRP is often combined with microneedling so those factors reach deeper after micro-channels are created—aligned with texture or rejuvenation goals you reviewed.";
      if (ctx.hasPrpFamily)
        return "Your plan references PRP because your provider selected a platelet-based option tied to the concerns you discussed.";
      return null;
    },
  },
  {
    id: "prfm",
    match: [/\bPRFM\b/i, /\bplatelet[- ]rich fibrin\b/i],
    chapterKeys: ["microneedling", "prp"],
    title: "PRFM (platelet-rich fibrin matrix)",
    body: "Similar family to PRP but prepared as a fibrin gel—often used to hold growth factors in place a bit longer for targeted application.",
    relationToYou: (ctx) =>
      ctx.hasMicroneedling
        ? "On your plan, PRFM is a microneedling-related add-on your clinic offers when they want that fibrin matrix benefit alongside needling."
        : ctx.hasPrpFamily
          ? "Your plan lists PRFM where your team chose this fibrin-based platelet option for your goals."
          : null,
  },
  {
    id: "ha",
    match: [/\bHA\b(?![a-z])/i, /\bhyaluronic acid\b/i],
    chapterKeys: ["filler"],
    title: "Hyaluronic acid (HA)",
    body: "A sugar molecule found naturally in skin that holds water. Most gel fillers use HA gels to restore volume and smooth lines.",
    relationToYou: (ctx) =>
      ctx.hasFiller
        ? "When your plan mentions HA, it’s describing the filler material selected for the areas and look you discussed."
        : null,
  },
  {
    id: "bbl",
    match: [/\bBBL\b/i, /\bbroadband light\b/i],
    chapterKeys: ["energy treatment", "energy device"],
    title: "BBL (broadband light)",
    body: "A light-based treatment that targets pigment, redness, and early sun damage while gently stimulating collagen over a series of visits.",
    relationToYou: (ctx) =>
      ctx.hasEnergyTreatment
        ? "In your plan, BBL refers to that light-based modality when your provider matched energy-based options to your tone and texture goals."
        : null,
  },
  {
    id: "moxi",
    match: [/\bMoxi\b/i],
    chapterKeys: ["energy treatment", "energy device"],
    title: "Moxi",
    body: "A gentle fractional laser that brightens tone, refines texture, and fits many skin types with relatively mild downtime.",
    relationToYou: (ctx) =>
      ctx.hasEnergyTreatment
        ? "Your energy-treatment selections may include Moxi when your team prioritized a lighter laser refresh."
        : null,
  },
  {
    id: "pdgf",
    match: [/\bPDGF\b/i, /\bplatelet[- ]derived growth factor\b/i],
    chapterKeys: ["microneedling", "prp", "skincare"],
    title: "PDGF (platelet-derived growth factor)",
    body: "Signaling proteins involved in repair; in aesthetics, topical products may use synthetic PDGF-like technology to support skin quality.",
    relationToYou: (ctx) =>
      ctx.hasPrpFamily
        ? "If PDGF appears in your plan, it’s usually in the context of growth-factor or regenerative options your provider tied to texture or repair goals."
        : null,
  },
  {
    id: "neuromodulator",
    match: [/\bneuromodulator\b/i, /\bBotox\b/i, /\bDysport\b/i],
    chapterKeys: ["neurotoxin"],
    title: "Neuromodulator (e.g. Botox, Dysport)",
    body: "Injectable medications that relax specific muscles to soften lines caused by expression, such as frown or forehead lines.",
    relationToYou: (ctx) =>
      ctx.hasNeurotoxin
        ? "Your plan uses this language for the wrinkle-relaxing treatment and dose range your provider aligned with your expression patterns."
        : null,
  },
  {
    id: "biostimulant",
    match: [/\bbiostimulant\b/i, /\bRadiesse\b/i, /\bSculptra\b/i, /\bSkinvive\b/i],
    chapterKeys: ["biostimulants"],
    title: "Biostimulant / collagen stimulator",
    body: "Injectables that encourage your tissue to build collagen over time, rather than only filling space immediately.",
    relationToYou: (ctx) =>
      ctx.hasBiostimulants
        ? "In your plan, these terms map to the volumizing or collagen-building products your provider chose for gradual structural improvement."
        : null,
  },
  {
    id: "jessner",
    match: [/\bJessner/i],
    chapterKeys: ["chemical peel"],
    title: "Jessner’s peel",
    body: "A blended peel (often salicylic, lactic, and resorcinol) used for pigment, texture, and acne—depth depends on how it’s applied.",
    relationToYou: (ctx) =>
      ctx.hasChemicalPeel
        ? "If Jessner appears in your plan, it’s a specific peel type your team matched to your skin concerns and tolerance."
        : null,
  },
  {
    id: "depigmentation_peel",
    match: [/\bDepigmentation\s*peel\b/i, /\bCosmelan\b/i],
    chapterKeys: ["chemical peel"],
    title: "Depigmentation peel",
    body: "A professional pigment protocol (often with home care) aimed at stubborn melasma and uneven tone under medical guidance.",
    relationToYou: (ctx) =>
      ctx.hasChemicalPeel
        ? "Your plan references a depigmentation peel when pigment correction was a priority in your visit."
        : null,
  },
];
