export type PvbNarrativeProfileChapter = {
  treatment: string;
  displayName: string;
  displayArea?: string | null;
  planItems?: Array<{ product?: string | null }>;
};

export type PvbTreatmentNarrativeProfile = {
  reasonRole: string;
  how: string;
  expect: string;
  fitRole: string;
};

type NarrativeRule = {
  test: RegExp;
  profile: PvbTreatmentNarrativeProfile;
};

function chapterSearchText(chapter: PvbNarrativeProfileChapter): string {
  return [
    chapter.treatment,
    chapter.displayName,
    ...(chapter.planItems ?? []).map((item) => item.product ?? ""),
  ]
    .join(" | ")
    .toLowerCase();
}

function formatEnglishList(items: string[]): string {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0] ?? "";
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

function areaPhrase(chapter: PvbNarrativeProfileChapter): string {
  const areas = (chapter.displayArea ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (areas.length === 0) return "the selected area";
  return formatEnglishList(
    areas.map((area) => {
      if (/^(the|your)\s+/i.test(area)) return area.toLowerCase();
      return `the ${area.toLowerCase()}`;
    }),
  );
}

function profile(
  reasonRole: string,
  how: string,
  expect: string,
  fitRole: string,
): PvbTreatmentNarrativeProfile {
  return { reasonRole, how, expect, fitRole };
}

const RULES: NarrativeRule[] = [
  {
    test: /\bmorpheus\s*8\b|rf\s*microneed/i,
    profile: profile(
      "tightening skin, refining texture, and supporting collagen in the treated area",
      "It combines microneedling with radiofrequency energy, creating controlled heat below the surface so the skin repairs itself with stronger collagen and elastin.",
      "Expect redness, warmth, and a sandpapery texture for a few days. Results build gradually over the following weeks, with firmness and texture usually improving most after a series.",
      "Morpheus8 is the collagen-remodeling step in the plan, so it pairs well with skincare, injectables, or body-contouring treatments that address different layers of the same goal.",
    ),
  },
  {
    test: /\bcool\s*sculpt|cryolipolysis/i,
    profile: profile(
      "non-surgical fat reduction in the selected treatment area",
      "It uses controlled cooling to target fat cells under the skin while leaving the surface tissue intact.",
      "The area can feel numb, tender, swollen, or firm afterward. Changes are gradual because the body clears treated fat cells over several weeks to months.",
      "CoolSculpting addresses the fat-reduction part of the plan, while muscle work, wellness support, or maintenance habits can help the overall contour look more balanced.",
    ),
  },
  {
    test: /\bem\s*sculpt|emsculpt|neo\b/i,
    profile: profile(
      "building muscle tone while also supporting body contour",
      "It uses electromagnetic muscle stimulation, and the NEO version adds radiofrequency heat, so the session can strengthen muscle contractions while also targeting fat.",
      "Most people feel muscle soreness similar to a hard workout, with little interruption to normal routines. Results build over the treatment series as strength and contour change together.",
      "EMSculpt NEO is the muscle-definition step in the plan, complementing fat-reduction, weight-management, or wellness recommendations instead of trying to solve everything alone.",
    ),
  },
  {
    test: /\bglacial|cryomodulation/i,
    profile: profile(
      "cooling-based care for redness, pigment, and post-inflammatory skin changes",
      "It uses controlled cooling to calm targeted skin activity and support a more even-looking complexion.",
      "Downtime is usually minimal, though the skin may look temporarily pink or feel cool and sensitive. Tone changes tend to be gradual and depend on the condition being treated.",
      "Glacial adds a calming tone-control layer to the plan, which can be especially useful when stronger resurfacing or collagen treatments are also being used.",
    ),
  },
  {
    test: /\bariessence|pdgf|platelet[-\s]?derived/i,
    profile: profile(
      "skin-quality support, repair signaling, and recovery around treatment",
      "It uses platelet-derived growth factor signaling to support tissue repair and healthier-looking skin quality in the treated area.",
      "Expect a gradual effect rather than an instant cosmetic change. It is often used to support healing, texture, and skin quality alongside procedures.",
      "PDGF support helps the plan recover and rebuild more efficiently, especially when paired with microneedling, laser, or other collagen-focused treatments.",
    ),
  },
  {
    test: /\bmedical weight loss|semaglutide|tirzepatide|glp-?1/i,
    profile: profile(
      "weight-management support under provider guidance",
      "It uses a structured medical program, sometimes including prescription medication, nutrition guidance, and follow-up adjustments based on response.",
      "Progress is usually measured over weeks to months. Your provider will monitor tolerance, appetite changes, body composition, and the plan details that keep it sustainable.",
      "Medical weight loss supports the systemic side of the plan, helping body-contouring or wellness recommendations work within a clearer long-term direction.",
    ),
  },
  {
    test: /\bpeptide therapy|bpc|tb-?500|cjc|ipamorelin|sermorelin|tesamorelin|aod|mk-?677/i,
    profile: profile(
      "targeted wellness support based on the priorities reviewed with your provider",
      "Peptide therapy uses short signaling proteins or related compounds to support specific pathways such as recovery, sleep, body composition, or tissue repair.",
      "The timeline depends on the peptide, dose, and schedule. Consistency and provider follow-up matter more than a single treatment day.",
      "Peptide therapy supports the internal wellness side of the plan, complementing aesthetic or body treatments that focus on visible structure and skin.",
    ),
  },
  {
    test: /\bfunctional wellness|wellness optimization|lab review/i,
    profile: profile(
      "the underlying wellness factors your provider wanted to evaluate or support",
      "It looks at symptoms, history, labs, habits, and goals together so recommendations can be adjusted to the person rather than treated as a one-size-fits-all service.",
      "Expect this part of the plan to be iterative. Follow-up, lab review, and consistency are usually what turn the recommendations into measurable progress.",
      "Functional wellness gives the plan a foundation, helping energy, recovery, body composition, and aesthetic goals make more sense together.",
    ),
  },
  {
    test: /\bhrt\b|hormone/i,
    profile: profile(
      "hormone-balance support when symptoms or labs suggest it may be appropriate",
      "It evaluates hormone patterns and uses provider-guided therapy or adjustments to support symptoms such as energy, sleep, mood, libido, or body-composition changes.",
      "Results are monitored over time, not judged from one dose. Your provider will usually adjust based on symptoms, labs, safety, and how you respond.",
      "HRT supports the internal-balance part of the plan, which can affect how well wellness, weight, recovery, and skin-quality goals hold over time.",
    ),
  },
  {
    test: /\bgut health|microbiome|gi\b/i,
    profile: profile(
      "digestion, inflammation, and gut-related wellness support",
      "It focuses on digestive patterns, nutrition, labs or testing, and targeted support so gut function is addressed as part of the broader health picture.",
      "Changes usually build gradually as triggers, nutrition, supplements, or medications are adjusted. Tracking symptoms over time helps your provider refine the plan.",
      "Gut-health work supports the baseline wellness environment that can influence energy, inflammation, skin, and body-composition progress.",
    ),
  },
  {
    test: /\bbbl\b|broadband|ipl|photofacial/i,
    profile: profile(
      "pigment, redness, sun damage, and overall tone",
      "It uses pulses of light to target unwanted pigment and visible vessels while supporting a clearer, more even-looking complexion.",
      "Expect temporary redness, warmth, and darkening of some pigment before it flakes or fades. A series is common when the goal is broader tone correction.",
      "BBL is the color-correction step in the plan, pairing well with resurfacing, skincare, and SPF so tone improvements are easier to maintain.",
    ),
  },
  {
    test: /\bmoxi\b/i,
    profile: profile(
      "early pigment changes, rough texture, dullness, and light resurfacing",
      "It uses a gentle fractional laser to create controlled micro-injuries that refresh the surface and encourage collagen renewal.",
      "Expect redness and a rough, bronzed texture for several days. Results are gradual and often look best after a short series plus consistent sunscreen.",
      "Moxi is the light resurfacing step in the plan, helping skincare and other energy treatments move tone and texture in the same direction.",
    ),
  },
  {
    test: /\bsofwave\b|ultherapy|ultrasound/i,
    profile: profile(
      "lifting and firming support without adding volume",
      "It uses ultrasound energy to heat deeper support layers, encouraging new collagen where skin laxity or mild sagging is the focus.",
      "Downtime is usually minimal, though tenderness can happen. Firming builds gradually over a few months as collagen remodeling develops.",
      "Ultrasound tightening supports the lift-and-firmness layer of the plan, complementing injectables, skincare, or resurfacing that target other concerns.",
    ),
  },
  {
    test: /\blaser|fraxel|halo|clear\s*\+\s*brilliant|picosure|picoway|vbeam|excel\s*v/i,
    profile: profile(
      "tone, texture, pigment, redness, or collagen renewal depending on the device selected",
      "Laser and light-based treatments use targeted energy to create controlled change in the skin, either by addressing color, resurfacing texture, or stimulating collagen.",
      "Downtime depends on the device and intensity. Most plans use a series or maintenance schedule because tone and texture improve in layers.",
      "Energy treatment is the skin-renewal layer of the plan, pairing with home care so pigment, texture, and collagen goals keep moving between visits.",
    ),
  },
  {
    test: /\bfacials?\b(?!\s+surgery)|\bfacial services\b|dermaplan|dermasweep|hydrafacial|glass skin|acne facial|calming facial/i,
    profile: profile(
      "skin maintenance, clarity, hydration, or calmness based on the facial selected",
      "It uses professional cleansing, exfoliation, extractions, infusion, or calming steps to support the skin without the intensity of a larger procedure.",
      "Results are usually visible quickly as a cleaner, smoother, or more hydrated look. The effect is maintenance-oriented, so regular cadence matters.",
      "Facials keep the plan maintained between more corrective treatments, helping the skin stay clearer, calmer, and better prepared for active products.",
    ),
  },
  {
    test: /\bbreast surgery|breast augmentation|breast lift|mastopexy|breast reduction|implant exchange/i,
    profile: profile(
      "breast shape, proportion, lift, or volume goals reviewed with your surgeon",
      "It is a surgical part of the plan, so the technique, incision pattern, implant choice, or tissue reshaping is customized to anatomy and goals.",
      "Expect a staged recovery with activity restrictions, swelling, and follow-up visits. Early shape changes are not the final result because tissues settle over weeks to months.",
      "Breast surgery is the structural part of the plan, while skin care, wellness, or other recommendations may support recovery and confidence around the larger transformation.",
    ),
  },
  {
    test: /\brhinoplasty|nose surgery|nasal|droopy tip|dorsal hump/i,
    profile: profile(
      "nasal shape, proportion, breathing-related structure, or profile balance",
      "It surgically refines the nasal framework, which may include bone, cartilage, tip support, bridge contour, or functional breathing anatomy.",
      "Swelling changes slowly after rhinoplasty. Most people see meaningful improvement once early swelling settles, but fine definition can continue evolving for many months.",
      "Rhinoplasty is the facial-balance step in the plan, often changing how the nose relates to the eyes, lips, chin, and overall profile.",
    ),
  },
  {
    test: /\bbleph|eyelid|brow lift|facelift|neck lift|lip lift|chin implant|otoplasty|ear surgery|fat transfer|facial surgery/i,
    profile: profile(
      "facial structure, lift, contour, or feature balance",
      "It is a procedure-based part of the plan, with the technique chosen around anatomy, tissue position, and the specific feature your provider is addressing.",
      "Recovery depends on the procedure, but swelling, bruising, and staged follow-up are common. The result usually becomes clearer as tissues settle and healing progresses.",
      "Facial surgery addresses anatomy and position directly, complementing non-surgical treatments that focus on skin quality, movement, volume, or maintenance.",
    ),
  },
  {
    test: /\bbody sculpting|liposuction|tummy tuck|abdominoplasty|body contour|body lift/i,
    profile: profile(
      "body contour, proportion, and areas where shape is the main concern",
      "It changes contour by addressing fat, skin, muscle support, or tissue position depending on the procedure selected.",
      "Expect swelling, compression, and activity restrictions when surgery is involved. Contour typically refines gradually as swelling resolves and the treated area settles.",
      "Body sculpting is the shape-and-contour part of the plan, while wellness, weight-management, or muscle-building recommendations can help maintain the result.",
    ),
  },
  {
    test: /\bvaginal rejuvenation|labiaplasty|feminine rejuvenation/i,
    profile: profile(
      "comfort, function, confidence, or anatomy-related concerns discussed with your provider",
      "It is a targeted procedure or treatment plan for intimate-area concerns, with the approach selected around symptoms, anatomy, and personal goals.",
      "Recovery and restrictions depend on the procedure. Your provider's aftercare instructions are especially important because comfort, healing, and follow-up guide the final result.",
      "This chapter addresses a specific quality-of-life goal within the plan, separate from aesthetic skin or facial treatments but still connected to overall confidence and wellbeing.",
    ),
  },
  {
    test: /\bchemical peel|jessner|lactic|sal[-\s]?x|glycolic|tca|cosmelan|depigmentation peel/i,
    profile: profile(
      "surface renewal, clarity, pigment, acne congestion, or texture",
      "It uses a controlled chemical exfoliation to remove dull or damaged surface cells and signal fresher-looking skin to come forward.",
      "Expect peeling or flaking depending on peel depth. Brightness and smoothness build as the skin turns over, with sunscreen being essential afterward.",
      "A peel is the surface-renewal step in the plan, helping skincare and other procedures work from a clearer, more even skin surface.",
    ),
  },
  {
    test: /\bmicroneedling|skinpen|prfm microneedling/i,
    profile: profile(
      "texture, pores, scarring, fine lines, and collagen support",
      "It creates controlled micro-channels in the skin to trigger repair and collagen remodeling, sometimes paired with growth-factor support.",
      "Expect redness and sensitivity for a few days. Texture and scar changes are gradual because collagen remodeling builds over multiple weeks and often over a series.",
      "Microneedling is the collagen-and-texture step in the plan, reinforcing skincare or energy treatments that are also aimed at stronger skin quality.",
    ),
  },
  {
    test: /\bfiller|juvederm|restylane|rha|voluma|volux|eyelight|lip filler|facial balancing|liquid facelift/i,
    profile: profile(
      "volume, contour, balance, or softening deeper folds",
      "It places injectable gel or filler strategically to restore support, improve proportion, or soften shadows where structure has changed.",
      "Expect possible swelling, tenderness, or bruising for a few days. The visible shape is often immediate, then settles as swelling resolves.",
      "Filler handles the structure-and-contour layer of the plan, while skincare, toxin, or energy treatments can address skin quality and movement.",
    ),
  },
  {
    test: /\bneurotoxin|botox|dysport|xeomin|daxxify|jeuveau/i,
    profile: profile(
      "expression lines, muscle-driven creasing, or facial balance",
      "It temporarily relaxes targeted muscles so movement-related lines soften and the treated area looks smoother at rest and in expression.",
      "Results usually begin within several days and continue settling over about two weeks. There is little downtime, but the effect is temporary and needs maintenance.",
      "Neurotoxin is the movement-control step in the plan, pairing with treatments that address volume, skin quality, or pigment from different angles.",
    ),
  },
  {
    test: /\bbiostimul|sculptra|radiesse/i,
    profile: profile(
      "gradual collagen support, firmness, and longer-range structure",
      "It stimulates your own collagen response over time rather than only placing immediate volume.",
      "Results develop gradually over months and often require a series. Mild swelling or bruising can happen early, but the goal is progressive, natural-looking support.",
      "Biostimulants are the long-game collagen step in the plan, complementing filler, skincare, and devices that address more immediate or surface-level needs.",
    ),
  },
  {
    test: /\bkybella|deoxycholic/i,
    profile: profile(
      "stubborn submental fullness or small fat pockets",
      "It uses deoxycholic acid injections to break down targeted fat cells in the selected area.",
      "Swelling is expected and can be noticeable for several days. More than one session is common, and the contour change appears gradually as swelling settles.",
      "Kybella addresses the fat-pocket part of the plan, especially when jawline or profile refinement is the goal alongside skin or muscle-focused treatments.",
    ),
  },
  {
    test: /\bthread\s*lift|pdo|pcl|suspension thread/i,
    profile: profile(
      "mild lifting and support where sagging is more important than volume",
      "It places dissolvable threads under the skin to create mechanical support while also encouraging collagen around the treated area.",
      "Expect tenderness, tightness, and possible bruising or swelling. The initial lift settles, while collagen support develops over time.",
      "Thread lift is the support-and-positioning step in the plan, working alongside injectables or skin treatments that improve shape and quality in other ways.",
    ),
  },
];

export function resolvePvbTreatmentNarrativeProfile(
  chapter: PvbNarrativeProfileChapter,
): PvbTreatmentNarrativeProfile | null {
  const text = chapterSearchText(chapter);
  const match = RULES.find((rule) => rule.test.test(text));
  if (!match) return null;
  return match.profile;
}

export function buildPvbProfileReasonSentence(
  chapter: PvbNarrativeProfileChapter,
): string | null {
  const narrative = resolvePvbTreatmentNarrativeProfile(chapter);
  if (!narrative) return null;
  const self = chapter.displayName.trim();
  if (!self) return null;
  return `${self} was included for ${narrative.reasonRole} in ${areaPhrase(chapter)}.`;
}

export function buildPvbProfileFitSentence(
  chapter: PvbNarrativeProfileChapter,
): string | null {
  return resolvePvbTreatmentNarrativeProfile(chapter)?.fitRole ?? null;
}
