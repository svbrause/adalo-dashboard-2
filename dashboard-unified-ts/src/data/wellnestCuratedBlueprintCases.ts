import type { BlueprintCasePhoto } from "../utils/postVisitBlueprintCases";
import { WELLNEST_OFFERINGS } from "./wellnestOfferings";

/**
 * Wellnest “Results like yours” — sourced from skin-type-react `wellnessQuiz.ts`:
 * `WELLNESS_PATIENT_STORIES` (headline + first-person story) and `WELLNESS_TREATMENT_IMAGE` → local files.
 *
 * Images: `public/post-visit-blueprint/videos/wellnest/` (same asset set as `WELLNEST_CASE_IMAGES` paths in the quiz repo).
 * `storyTitle` = headline; `caption` = story body + disclaimer (both render in carousel + case detail).
 *
 * Each offering gets **three** slides in order: primary patient story, then two education-style cases
 * (from `WELLNESS_TREATMENTS` in the quiz repo) with alternate images.
 *
 * Appended: photo-only extras from `WELLNEST_EXTRA_CASES` (non-video) for select treatments (fourth slide where present).
 */

const WELLNEST_MEDIA_BASE = "/post-visit-blueprint/videos/wellnest";

const DISCLAIMER =
  "Composite educational vignette from our wellness results experience—not a specific patient. Results vary; follow your clinician’s guidance.";

/** Filenames under `public/post-visit-blueprint/videos/wellnest/` (see glob / skin-type-react `WELLNEST_CASE_IMAGES`). */
const CASE_IMAGE_FILE: Record<string, string> = {
  muscle1: "Eric-Ouollette-1-1.webp",
  muscle2: "Picture1 (1).jpg",
  muscle3: "fat-loss-peptide-before-after-expectations.webp",
  muscle4: "1d6453db5e11678e3a567a8e03151c3e.jpg",
  muscle5: "peptide-bna-2-edit.webp",
  muscle6: "Before+After+23-640w.webp",
  muscle7: "images.jpeg",
  bone1: "images.jpeg",
  bone2: "images (2).jpeg",
  weight1: "Weight-Loss-Injections-tirzepatide-peptides-scottsdale-az.webp",
  weight2: "images (2).jpeg",
  weight3: "peptide-bna-2-edit.webp",
  weight4: "Before+After+23-640w.webp",
  weight5: "images.jpeg",
  skin1: "02_BA.jpg",
  skin2: "20240924_liquid_peptides_advanced_mp_pdp_asset4_v03.webp",
  skin3: "71Zck-8VLgL._AC_UF350,350_QL80_.jpg",
  skin4: "Col-ss1-BreeA-en.webp",
  skin5: "02_BA.jpg",
  brain1: "02_BA.jpg",
  brain2: "20240924_liquid_peptides_advanced_mp_pdp_asset4_v03.webp",
  brain3: "71Zck-8VLgL._AC_UF350,350_QL80_.jpg",
  brain4: "Col-ss1-BreeA-en.webp",
};

function assetUrl(fileName: string): string {
  return `${WELLNEST_MEDIA_BASE}/${encodeURIComponent(fileName)}`;
}

function urlForImageKey(key: string): string {
  const file = CASE_IMAGE_FILE[key];
  return file ? assetUrl(file) : assetUrl("images.jpeg");
}

/**
 * Matches `WELLNESS_TREATMENT_IMAGE` in skin-type-react `wellnessQuiz.ts`.
 */
const WELLNESS_QUIZ_ID_TO_IMAGE_KEY: Record<string, string> = {
  "bpc-157": "muscle1",
  "tb-500": "muscle6",
  "cjc-1295": "muscle3",
  ipamorelin: "muscle4",
  "ghrp-2-6": "muscle5",
  "igf-1-lr3": "muscle6",
  "mk-677": "bone1",
  cartalax: "bone2",
  tessamorelin: "weight1",
  "aod-9604": "weight2",
  "ghk-cu": "skin1",
  "melanotan-2": "skin2",
  sermorelin: "skin2",
  epitalon: "skin4",
  semax: "brain1",
  selank: "brain2",
  p21: "brain3",
  pinealon: "brain4",
};

/** Copied from skin-type-react `WELLNESS_PATIENT_STORIES` (Wellnest voice; no compound names in copy). */
const WELLNESS_PATIENT_STORIES: Record<string, { headline: string; story: string }> = {
  "bpc-157": {
    headline: "I was tired of my gut and joints holding me back",
    story:
      "I was noticing as I got older it was taking longer to recover from workouts, and my gut wasn't what it used to be. I wanted to feel strong again without the aches and the bloating—something that could support my body from the inside out.",
  },
  "tb-500": {
    headline: "I wanted to get back to moving without the nagging pain",
    story:
      "After years of being active, I started to feel like my body was working against me. Every tweak took forever to heal. I was looking for something that could help me recover faster and get back to the activities I love.",
  },
  "cjc-1295": {
    headline: "My energy and metabolism weren't what they used to be",
    story:
      "I was noticing as I got older it was taking longer to recover from workouts and my metabolism wasn't what it used to be. I wanted to feel strong again—more energy, better recovery, and a body that felt like it was on my side.",
  },
  ipamorelin: {
    headline: "I wanted better sleep and to feel like myself again",
    story:
      "Sleep had become a struggle, and I could tell it was affecting everything—my mood, my recovery, my waistline. I was looking for something that could help me sleep better and support my body without harsh side effects.",
  },
  semax: {
    headline: "I was tired of the brain fog and losing my focus",
    story:
      "I used to feel sharp and on top of things. Lately I was forgetting names, losing my train of thought, and feeling like I was running in fog. I wanted to feel clear and focused again.",
  },
  selank: {
    headline: "Stress was running my life and I wanted my calm back",
    story:
      "I was always wound up—anxiety and stress were affecting my sleep, my mood, and my ability to enjoy life. I wanted support that could help me feel more balanced and resilient without dulling me down.",
  },
  p21: {
    headline: "I wanted to protect my memory and stay sharp",
    story:
      "As I got older I started to notice little slips—forgetting where I put things, names taking longer to come back. I wanted to do something proactive for my brain and my memory while I still could.",
  },
  pinealon: {
    headline: "I wanted to support my brain health for the long run",
    story:
      "I've seen what cognitive decline can do. I wanted to take care of my brain the way I take care of the rest of my body—something that could support clarity and cognitive health as I age.",
  },
  "ghrp-2-6": {
    headline: "I wanted to recover better and feel stronger",
    story:
      "I was putting in the work but not seeing the results I used to. Recovery felt slow and my body composition was shifting in the wrong direction. I was looking for support that could help me get back to feeling strong and lean.",
  },
  "igf-1-lr3": {
    headline: "I wanted to build and maintain muscle without the struggle",
    story:
      "I'd always been active, but as I got older it felt harder to hold on to muscle and strength. I wanted support that could help me recover, build, and feel like an athlete again—not just get by.",
  },
  "ghk-cu": {
    headline: "I wanted my skin to look as healthy as I felt",
    story:
      "I was taking care of myself on the inside, but my skin was still showing the years—laxity, dullness, and a lack of that bounce it used to have. I wanted something that could support firmness and a more youthful look.",
  },
  "melanotan-2": {
    headline: "I wanted a natural glow without baking in the sun",
    story:
      "I love how I look and feel with a bit of color, but I didn't want to damage my skin or spend hours in the sun. I was looking for a way to get a natural-looking tan and feel good in my skin.",
  },
  "mk-677": {
    headline: "I was worried about my bones and joints as I aged",
    story:
      "I'd seen family members struggle with bone density and joint issues. I wanted to do something early to support my bones and joints so I could stay active and independent for years to come.",
  },
  sermorelin: {
    headline: "I wanted to age well and keep my energy and recovery",
    story:
      "I wasn't trying to turn back the clock—I just wanted to feel like myself. Better recovery, more energy, and skin that didn't look as tired as I sometimes felt. I was looking for something that worked with my body, not against it.",
  },
  tessamorelin: {
    headline: "The weight around my middle wouldn't budge",
    story:
      "I was eating well and moving more, but the stubborn fat around my belly wasn't shifting. I wanted support that could target that area and help my metabolism work with me, not against me.",
  },
  epitalon: {
    headline: "I wanted to support how I age from the inside out",
    story:
      "I was thinking long-term—cellular health, metabolism, and feeling vibrant as I get older. I wanted something that could support my body's natural processes and help me age well.",
  },
  "aod-9604": {
    headline: "I was done fighting my metabolism alone",
    story:
      "I'd tried everything for my weight and body composition. My metabolism felt like it had a mind of its own. I was looking for support that could help with fat metabolism and finally work with my body.",
  },
  cartalax: {
    headline: "I wanted to protect my joints and stay mobile",
    story:
      "My knees and joints were starting to remind me of every workout and every year. I wanted to support my cartilage and joint health so I could keep moving without the constant ache.",
  },
};

/** Photo-only extras from `WELLNEST_EXTRA_CASES` (skin-type-react), mapped to a dashboard treatment name. */
const WELLNEST_EXTRA_PHOTO_CASES: Array<{
  id: string;
  imageKey: keyof typeof CASE_IMAGE_FILE;
  treatmentName: string;
  headline: string;
  story: string;
}> = [
  {
    id: "wellnest-extra-muscle7",
    imageKey: "muscle7",
    treatmentName: "Thymosin Beta-4 (TB-500)",
    headline: "I wanted to recover faster and get back to what I love",
    story:
      "I was tired of every tweak and strain taking forever to heal. I wanted support that could help my body recover so I could stay active and keep doing the things that matter to me.",
  },
  {
    id: "wellnest-extra-weight4",
    imageKey: "weight4",
    treatmentName: "Tesamorelin",
    headline: "I wanted to feel strong and lean again",
    story:
      "After years of ups and downs, I wanted a sustainable approach to how I looked and felt. I was ready for something that could support my body composition and energy without the roller coaster.",
  },
  {
    id: "wellnest-extra-weight5",
    imageKey: "weight5",
    treatmentName: "CJC-1295",
    headline: "I wanted my body to work with me, not against me",
    story:
      "I was tired of feeling like my weight was out of my control. I wanted support that could help with stubborn fat and metabolism so I could feel like myself again.",
  },
  {
    id: "wellnest-extra-skin5",
    imageKey: "skin5",
    treatmentName: "GHK-Cu",
    headline: "I wanted to take care of my skin from the inside out",
    story:
      "I was noticing more lines and uneven tone than I wanted. I was looking for something that could support my skin's natural repair and help me feel confident without the heavy routines.",
  },
];

function photoForQuizId(quizId: string): string {
  const imageKey = WELLNESS_QUIZ_ID_TO_IMAGE_KEY[quizId];
  return imageKey ? urlForImageKey(imageKey) : assetUrl("images.jpeg");
}

function photoForImageKey(key: string): string {
  return urlForImageKey(key as keyof typeof CASE_IMAGE_FILE);
}

/**
 * Extra case images per quiz id (different from primary in {@link WELLNESS_QUIZ_ID_TO_IMAGE_KEY}).
 */
const WELLNESS_QUIZ_ALT_IMAGE_KEYS: Record<string, [string, string]> = {
  "bpc-157": ["muscle3", "muscle7"],
  "tb-500": ["muscle2", "muscle4"],
  "cjc-1295": ["muscle4", "muscle6"],
  ipamorelin: ["muscle3", "muscle5"],
  "ghrp-2-6": ["muscle1", "muscle6"],
  "igf-1-lr3": ["muscle2", "muscle4"],
  "mk-677": ["bone2", "muscle7"],
  cartalax: ["bone1", "muscle7"],
  tessamorelin: ["weight2", "weight3"],
  "aod-9604": ["weight1", "weight4"],
  "ghk-cu": ["skin2", "skin4"],
  "melanotan-2": ["skin1", "skin3"],
  sermorelin: ["skin2", "skin1"],
  epitalon: ["skin3", "skin2"],
  semax: ["brain2", "brain4"],
  selank: ["brain1", "brain4"],
  p21: ["brain2", "brain4"],
  pinealon: ["brain1", "brain3"],
};

/** Clinical/education blurbs from skin-type-react `WELLNESS_TREATMENTS` (offerings CSV). */
const WELLNEST_TREATMENT_EDU: Record<
  string,
  { category: string; summary: string; addresses: string; ideal: string; duration: string }
> = {
  "bpc-157": {
    category: "Injury recovery, inflammation, gut health",
    summary:
      "A peptide that supports soft tissue and tendon/ligament repair, reduces inflammation, and helps with gut lining and chronic GI issues. Often used after injury or intense training.",
    addresses:
      "Soft tissue repair support, tendon/ligament recovery, chronic GI issues, GI lining support, anti-inflammatory properties",
    ideal:
      "Anyone aged 30+ with significant contact sports, extreme workouts, or physically active after 40 (male and female)",
    duration: "2 weeks – 8 weeks",
  },
  "tb-500": {
    category: "Musculoskeletal injury",
    summary:
      "Supports faster muscle recovery, reduces inflammation, and improves mobility. Commonly used alongside BPC-157 for sports and activity-related injuries.",
    addresses: "Accelerated muscle recovery, reduced inflammation, improved mobility",
    ideal: "Anyone aged 30+ with contact sports, extreme workouts, or physically active after 40",
    duration: "1 week – 8 weeks",
  },
  "cjc-1295": {
    category: "Low energy, poor recovery, metabolic optimization",
    summary:
      "Promotes natural growth hormone release and IGF-1, supporting energy, recovery, fat metabolism, and muscle toning. Used for metabolic and body-composition goals.",
    addresses: "Increased IGF-1, fat metabolism support, improved recovery",
    ideal: "Poor muscle mass gain, toning in men and women",
    duration: "4 weeks – 10 weeks",
  },
  ipamorelin: {
    category: "Sleep and muscle growth",
    summary:
      "Stimulates natural growth hormone release with minimal side effects. Supports sleep quality, lean muscle preservation, and recovery—often preferred for 40+ for sleep and body composition.",
    addresses:
      "Selective ghrelin receptor agonist, natural GH release, minimal cortisol elevation, lean mass preservation",
    ideal: "Aged 40+ both sexes",
    duration: "4 weeks – 10 weeks",
  },
  semax: {
    category: "Memory and focus",
    summary:
      "A nootropic peptide that may support focus, clarity, and cognitive function. Used to address brain fog and mild cognitive concerns.",
    addresses: "Brain fog, focus, cognitive decline",
    ideal: "Aged 30+",
    duration: "8 weeks – 16 weeks",
  },
  selank: {
    category: "Anxiety, fatigue, chronic stress",
    summary:
      "Supports mood balance, reduced anxiety, and improved resilience to stress. May also support cognition and fatigue related to stress.",
    addresses: "Anxiolytic effects, improved cognition, mood balance",
    ideal: "Aged 30+ both sexes",
    duration: "6 weeks – 16 weeks",
  },
  p21: {
    category: "Memory",
    summary:
      "Supports synapse regeneration and cognitive function. Typically considered for older adults (60+) with memory or cognitive decline concerns.",
    addresses: "Synapse regeneration",
    ideal: "Aged 60+",
    duration: "3–6 months",
  },
  pinealon: {
    category: "Memory",
    summary:
      "Supports brain antioxidant defenses and may help with age-related cognitive decline. Often used in the 60+ population for memory and clarity.",
    addresses: "Brain oxidative defense, cognitive decline",
    ideal: "Aged 60+",
    duration: "3–6 months",
  },
  "ghrp-2-6": {
    category: "Muscle loss",
    summary:
      "Growth hormone–releasing peptides that support recovery and body composition. Used to help maintain or build lean mass and support energy in adults 35+.",
    addresses: "Recovery, body composition",
    ideal: "Aged 35+",
    duration: "2–5 months",
  },
  "igf-1-lr3": {
    category: "Muscle bulk assistance",
    summary:
      "A long-acting form of IGF-1 that supports muscle growth and recovery. Often used by those 35+ seeking muscle bulk or athletic performance support.",
    addresses: "Muscle growth",
    ideal: "Aged 35+",
    duration: "2–5 months",
  },
  "ghk-cu": {
    category: "Skin health",
    summary:
      "Copper peptide that supports skin firmness, elasticity, and repair. Used for skin laxity, anti-aging, and wound healing—often in 40+ for skin and longevity goals.",
    addresses: "Skin firmness, skin laxity and elastin stimulation",
    ideal: "Aged 40+",
    duration: "2–3 months",
  },
  "melanotan-2": {
    category: "Skin tan, libido",
    summary:
      "Supports natural tanning through melanin stimulation and may support libido. Used by adults 30+ for tanning and related wellness goals.",
    addresses: "Melanin increase, libido increase",
    ideal: "Natural tanning peptide pathway; provider discretion",
    duration: "3 months",
  },
  "mk-677": {
    category: "Bone density, joint health",
    summary:
      "A growth hormone secretagogue studied for bone density and joint health. Often considered for adults concerned with osteoporosis or osteoarthritis.",
    addresses: "Bone density decline prevention",
    ideal: "Often 65+",
    duration: "3+ months",
  },
  sermorelin: {
    category: "Anti-aging",
    summary:
      "Stimulates the body’s own growth hormone release in a physiologic way. Used for anti-aging, recovery, and energy in adults 40+.",
    addresses: "Physiologic GH stimulation, anti-aging interest",
    ideal: "Aged 40+",
    duration: "8–12 weeks",
  },
  tessamorelin: {
    category: "Visceral fat, metabolic support",
    summary:
      "Targets visceral fat and supports healthy body composition. Used as an adjunct for weight and metabolic goals in adults 40+.",
    addresses: "Obesity adjunct therapy",
    ideal: "Aged 40+",
    duration: "3+ months",
  },
  epitalon: {
    category: "Cellular aging",
    summary:
      "Supports cellular aging and metabolism. Used for longevity and general anti-aging in adults 40+.",
    addresses: "Metabolism reset",
    ideal: "Aged 40+",
    duration: "3+ months",
  },
  "aod-9604": {
    category: "Fat metabolism",
    summary:
      "A fragment of growth hormone that supports fat metabolism and body composition. Used as an adjunct for weight and metabolic goals in adults 30+.",
    addresses: "Obesity adjunct therapy",
    ideal: "Aged 30+ both sexes",
    duration: "3+ months",
  },
  cartalax: {
    category: "Osteoarthritis",
    summary:
      "Supports cartilage repair and joint health. Used for osteoarthritis and joint wear in adults 50+.",
    addresses: "Cartilage repair",
    ideal: "Aged 50+",
    duration: "3+ months",
  },
};

function buildPrimaryCases(): BlueprintCasePhoto[] {
  const out: BlueprintCasePhoto[] = [];
  for (const o of WELLNEST_OFFERINGS) {
    const qid = o.wellnessQuizId;
    if (!qid) continue;
    const story = WELLNESS_PATIENT_STORIES[qid];
    if (!story) continue;
    out.push({
      id: `wellnest-quiz-${qid}`,
      photoUrl: photoForQuizId(qid),
      treatments: [o.treatmentName],
      storyTitle: story.headline,
      caption: `${story.story} ${DISCLAIMER}`,
    });
  }
  return out;
}

/** Second and third slides: education-style copy + alternate wellnest images. */
function buildSecondaryCases(): BlueprintCasePhoto[] {
  const out: BlueprintCasePhoto[] = [];
  for (const o of WELLNEST_OFFERINGS) {
    const qid = o.wellnessQuizId;
    if (!qid) continue;
    const edu = WELLNEST_TREATMENT_EDU[qid];
    const keys = WELLNESS_QUIZ_ALT_IMAGE_KEYS[qid];
    if (!edu || !keys) continue;
    const [keyB, keyC] = keys;
    out.push(
      {
        id: `wellnest-quiz-${qid}-edu-b`,
        photoUrl: photoForImageKey(keyB),
        treatments: [o.treatmentName],
        storyTitle: `What we often discuss: ${edu.category}`,
        caption: `${edu.summary} Typical goals also include: ${edu.addresses} ${DISCLAIMER}`,
      },
      {
        id: `wellnest-quiz-${qid}-edu-c`,
        photoUrl: photoForImageKey(keyC),
        treatments: [o.treatmentName],
        storyTitle: "Who this is usually for",
        caption: `In consults we often review whether someone fits the usual profile: ${edu.ideal} Timelines discussed in care are often on the order of ${edu.duration}. ${DISCLAIMER}`,
      },
    );
  }
  return out;
}

function buildExtraPhotoCases(): BlueprintCasePhoto[] {
  return WELLNEST_EXTRA_PHOTO_CASES.map((row) => ({
    id: row.id,
    photoUrl: urlForImageKey(row.imageKey),
    treatments: [row.treatmentName],
    storyTitle: row.headline,
    caption: `${row.story} ${DISCLAIMER}`,
  }));
}

export const WELLNEST_CURATED_BLUEPRINT_CASES: BlueprintCasePhoto[] = [
  ...buildPrimaryCases(),
  ...buildSecondaryCases(),
  ...buildExtraPhotoCases(),
];
