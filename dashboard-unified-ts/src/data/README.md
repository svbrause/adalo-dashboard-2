# Skin Type Quiz data

**File to edit:** `skinTypeQuiz.ts`

## Airtable: store quiz results (all users)

Add one **Long text** field to both **Patients** and **Web Popup Leads**:

- **Field name:** `Skincare Quiz`
- **Contents:** JSON string of the quiz result (see below).

No other DB changes are needed. The app reads and writes this field for any client.

**JSON shape** (stringify before saving):

```json
{
  "version": 1,
  "completedAt": "2025-02-23T12:00:00.000Z",
  "answers": { "q1": 0, "q2": 2, "q3": 1, ... },
  "result": "combination",
  "recommendedProductNames": ["SkinCeuticals Daily Moisture | ...", ...]
}
```

- `answers`: question id → selected answer index (0-based).
- `result`: one of `oily` | `dry` | `combination` | `normal` | `sensitive`.
- Use `buildSkincareQuizPayload(answers)` to build this object and `SKINCARE_QUIZ_FIELD_NAME` when calling `updateLeadRecord`.

### Public quiz link (SMS)

From the client details screen, staff can send an SMS with a **unique quiz link** (e.g. `https://your-dashboard.com/skin-quiz?r=recXXX&t=Patients`). The patient opens the link on their phone and gets a **standalone, mobile-friendly quiz page** (no dashboard login). On completion, the app calls `submitSkinQuizFromLink(recordId, tableName, payload)` which hits the backend. **Backend must implement** `POST /api/skin-quiz/submit` with body `{ recordId, tableName, payload }` and update the Airtable record’s "Skincare Quiz" field with `JSON.stringify(payload)`. Optionally update the linked Web Popup Lead if the record is a Patient with `linkedLeadId`.

## Scoring and product mapping

- **Scoring:** For each question, the selected answer’s `scores` are summed per skin type. The type with the highest total wins (ties broken by a fixed order).
- **Result:** Use `computeQuizResult(answersByQuestionId)` where `answersByQuestionId` is `{ [questionId]: selectedAnswerIndex }` (0-based index).
- **Products:** `getRecommendedProductsForSkinType(skinType)` returns product names from our boutique list. Match these to `getSkincareCarouselItems()` or `TREATMENT_BOUTIQUE_SKINCARE` by name for full product details (image, URL).

## How to add scraped questions

For each multiple-choice question from the quiz, add one object to the `questions` array in this shape:

```ts
{
  id: "q2",                    // unique id: q1, q2, q3, ...
  question: "Paste question text here exactly as shown.",
  answers: [
    { label: "First answer choice", scores: { oily: 1, dry: 0 } },
    { label: "Second answer choice", scores: { combination: 2 } },
    { label: "Third answer choice", scores: { sensitive: 1, dry: 1 } },
  ],
},
```

### Scores (logic)

- **scores** = which skin type(s) this answer suggests.
- Use **1** for a mild suggestion, **2** for a strong suggestion.
- Omit a type or use `0` if the answer doesn’t point to that type.
- Valid keys: `oily`, `dry`, `combination`, `normal`, `sensitive`.

Example: *“Shiny all over”* → `{ oily: 2 }`.  
*“A bit oily on my nose only”* → `{ combination: 2 }`.

You don’t need to document logic separately; the scoring in `scores` is what the app (and I) will use to compute the result.

## Checklist when pasting

1. Keep **question** and **label** strings exactly as on the site (or fix typos once).
2. Give every question a unique **id** (`q1`, `q2`, …).
3. For every answer, set **scores** so at least one type has a value ≥ 1.
4. Save the file; the app (and I) will read from `SKIN_TYPE_QUIZ` in `skinTypeQuiz.ts`.
