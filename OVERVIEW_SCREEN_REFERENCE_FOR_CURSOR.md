# Overview Screen Reference for Cursor

Use this document in **another app project** so Cursor can implement an analysis overview screen similar to the one in the patient app. Copy this file into the root (or `docs/`) of your other app and prompt Cursor with: *"Implement an overview screen based on OVERVIEW_SCREEN_REFERENCE_FOR_CURSOR.md"*.

---

## 1. Purpose

A single **Overview** screen that:

- Shows an **overall score** (0–100) with a circular gauge and tier label (e.g. Excellent / Good / Moderate / Attention).
- Shows **categories** (e.g. Skin Health, Volume Loss, Proportions) as expandable cards; each card has a score and, when expanded, **Strengths** and **Areas for Improvement** with pill-style items (e.g. "Wrinkles 2/3 look good", "Eye Area 1/3").
- Shows a short **personalized summary** (typewriter-style optional).
- Shows **areas** (e.g. Forehead, Eyes, Cheeks) in a second section, optionally split into "Focus Areas" (starred) and "All Areas", each as expandable cards with theme-grouped strengths/improvements.
- Provides **navigation** to category detail and area detail screens (e.g. "Explore Skin Health Details", "Explore Eyes Details").
- Has a **sticky header** (back, title) and a **fixed footer CTA** (e.g. "Explore Your Treatments").

---

## 2. Data Model (adapt to your app)

### Inputs the overview needs

- **Detected issues**: A set (or list) of normalized issue names that were "detected" for the user (e.g. from an analysis or survey).
- **Interest/focus areas** (optional): Names of areas the user marked as focus so you can show "Focus Areas" first with a star.
- **Records** (optional): If your data comes as records (e.g. Airtable), you need a way to extract:
  - Issue list per record (e.g. comma-separated "Issues String").
  - Whether the record is an area of interest and which area name it belongs to.

### Core config your app must define

- **Categories**: Each has `name`, `key`, and `subScores`. Each sub-score has `name` and `issues` (array of issue names).
- **Areas**: Each has `name` and `issues` (array of issue names). Used for the area breakdown section.
- **Area themes** (optional): For each area, a list of theme objects `{ label, issues }` so you can show e.g. "Skin Laxity", "Volume", "Fine Lines" under Eyes.

### Normalization

- Use a single **normalizeIssue(name)** so that "Crow's Feet" and "crow's feet" match: e.g. lowercase, trim, collapse spaces, normalize apostrophes.

---

## 3. Scoring and Tiers

- **Score** for a set of issues = percentage *not* detected.  
  `score = round(((total - detectedCount) / total) * 100)`.  
  So 0 detected → 100, all detected → 0.
- **Tiers** from score (example thresholds):
  - 90+ → `excellent` (e.g. green)
  - 70–89 → `good` (e.g. light green)
  - 50–69 → `moderate` (e.g. orange)
  - &lt;50 → `attention` (e.g. dark orange)
- **Overall score** = average of category scores (or your preferred aggregation).
- Provide **tierLabel(tier)** and **tierColor(tier)** for UI.

---

## 4. Strengths vs Areas for Improvement (no duplication)

- Each **sub-score** (or theme) should appear in **only one** of the two lists.
- Rule: put the item in the list where it has the **higher count**:
  - If "look good" count &gt; "detected" count → **Strengths** only.
  - If "detected" count &gt; "look good" count → **Areas for Improvement** only.
  - If tied, put in Strengths (or your choice).
- **Guarantee at least one in each list** when you have enough items: if one list is empty, move the "weakest" item from the other list (e.g. smallest improvement count or smallest strength count) into the empty list.

Helper signature (implement in your config or utils):

```ts
function splitStrengthsAndImprovements<T>(
  items: T[],
  getGoodCount: (t: T) => number,
  getImpCount: (t: T) => number,
): { strengths: T[]; improvements: T[] }
```

Use it for:
- Category cards: items are sub-scores with `total`, `detected`; good = `total - detected`, imp = `detected`.
- Area cards: items are theme summaries with `totalCount`, `detectedCount`; good = `totalCount - detectedCount`, imp = `detectedCount`.

---

## 5. Component Structure

- **AnalysisOverview** (main screen)
  - **Header**: Back button, eyebrow text ("Your Results"), title ("Aesthetic Analysis" or your title).
  - **Hero**:
    - Optional user photo (e.g. circular).
    - **ScoreGauge**: SVG circular gauge (score 0–100), tier color, optional label (e.g. "Skin Age Score").
    - **Category cards** (expandable): list of categories; each **CategoryCard** shows name, score badge, chevron; when open, shows Strengths pills and Areas for Improvement pills, then "Explore [Category] Details" button.
    - **Assessment**: Short summary text; optional typewriter effect (character-by-character reveal).
  - **Area section**:
    - Optional "Focus Areas" group (if any) with star icon; then "All Areas".
    - **AreaCard** per area: name, optional star if focus, score badge, chevron; when open, Strengths and Areas for Improvement (theme pills), then "Explore [Area] Details" button.
  - **Footer**: Fixed CTA button (e.g. "Explore Your Treatments" →).

### Props the overview needs

- Data: `records` (or whatever holds issues/areas) and optionally `email`/user id for photo or preferences.
- Callbacks: `onBack`, `onContinue` (footer CTA), `onNavigateToCategory(categoryKey)`, `onNavigateToArea(areaName)`.

---

## 6. UI Patterns and CSS Hints

- **Gauge**: SVG circle with `stroke-dasharray` / `stroke-dashoffset` for progress; rotate -90° so it starts at top. Background ring + colored ring. Center text: score number and optional label.
- **Category/Area cards**: White card, border, border-radius (~14px). Header: full-width button (name + score + chevron). Body: two groups ("Strengths", "Areas for Improvement"); each group has a small uppercase title and a flex wrap of pills.
- **Pills**: Rounded (e.g. 50px border-radius), small padding; green-tinted for strengths, orange-tinted for improvements; include count e.g. "2/3 look good" or "1/3".
- **Empty state**: If no strengths or no improvements, show one line of italic placeholder text (e.g. "All features need attention" / "None — looking good").
- **Sticky header**: e.g. sticky top, background + backdrop-filter so content scrolls underneath.
- **Fixed footer**: Fixed bottom, full-width CTA button; add bottom padding to the scrollable body so content isn’t hidden behind it.

---

## 7. Optional: Assessment Text

- Can be **static** from a `generateAssessment(overall, categories, focusCount)` that returns a string (e.g. "Your overall score of 78 shows… Your skin health scored highest… Your primary opportunity is volume loss…").
- Or **async** from an API; show "Generating…" until loaded. Optional typewriter: reveal text character-by-character with a blinking cursor.

---

## 8. Optional: Photo

- If you have a user/patient photo URL, show it in the hero (e.g. 100×100 circle, object-fit cover, border/shadow).

---

## 9. File Checklist for Implementation

In your other app, Cursor can create or extend:

1. **Config**
   - Issue normalization.
   - Categories (name, key, subScores with issues).
   - Areas (name, issues).
   - Area themes (label + issues) per area.
   - Scoring: `scoreIssues`, `scoreTier`, `tierLabel`, `tierColor`, `computeCategories`, `computeOverall`, `computeAreas`, `splitStrengthsAndImprovements`, `summarizeAreaThemes` (if using themes).

2. **Components**
   - `AnalysisOverview.tsx`: main screen, state for expand/collapse and animation.
   - `ScoreGauge`: SVG gauge component.
   - `CategoryCard`: expandable category with strengths/improvements pills and explore button.
   - `AreaCard`: expandable area with theme pills and explore button.
   - Optional: `TypewriterText` for assessment.

3. **Styles**
   - `AnalysisOverview.css`: layout (header, body, footer), hero, gauge, category cards, area cards, pills, assessment, CTA. Use BEM-like classes (e.g. `ao__header`, `ao__cat-card__pill--good`) for clarity.

4. **Navigation**
   - Wire `onNavigateToCategory` and `onNavigateToArea` to your router or parent so "Explore … Details" opens the corresponding detail screen.

---

## 10. Summary

- One overview screen: overall score gauge + expandable category cards (with strengths/improvements, no duplicate items) + optional assessment + area cards (optionally Focus vs All) + footer CTA.
- Data: detected issues set, optional focus area names; config: categories, areas, area themes.
- Scoring: 0–100 from % not detected; tiers for color/labels.
- Use `splitStrengthsAndImprovements` so each sub-score/theme appears in only one list; ensure at least one in each list when possible.
- Copy this file into your other app and ask Cursor to implement the overview screen from it.
