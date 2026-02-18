# Framework mapping: dashboard ↔ Issue-to-Concern mapping

This doc describes how the **external issue-to-concern mapping** (ISSUE_TO_CONCERN_MAPPING.md + issue-to-concern-mapping.csv) aligns with the **dashboard framework** in `analysisOverviewConfig.ts` and `utils/issueMapping.ts`, and how we use it to improve consistency and optional 5-category taxonomy.

---

## Current dashboard framework

| Element | Source | Notes |
|--------|--------|------|
| **Categories** | `analysisOverviewConfig.ts` → CATEGORIES | 3: **Skin Health**, **Volume Loss**, **Proportions** |
| **Sub-scores** | Per-category (e.g. Wrinkles, Texture, Pigmentation, Hydration under Skin Health) | Used for radar/bar and feature breakdown |
| **Areas** | AREAS | **Forehead, Eyes, Cheeks, Nose, Lips, Jawline, Skin** (no Chin/Neck as top-level; neck/chin live under Jawline) |
| **Issue names** | Display style from Airtable: "Crow's Feet Wrinkles", "Nasolabial Folds", etc. | Matched via `normalizeIssue()` (lowercase, trim, collapse spaces) |
| **Issue → Area** | `utils/issueMapping.ts` → issueToAreaMap | One area per issue; used by `groupIssuesByArea()` |

---

## External mapping (CSV + MD)

| Element | Source | Notes |
|--------|--------|------|
| **General categories** | 5: **Skin Health**, **Volume Loss**, **Proportions**, **Skin Laxity**, **Excess Fat** | Two extra vs dashboard: Skin Laxity, Excess Fat |
| **Concerns** | 8: Fine Lines & Wrinkles, Skin Texture, Pigmentation, Facial Asymmetry, Facial Structure, Skin Laxity, Volume Loss, Excess Fat | Mapped into the 5 categories |
| **Areas** | Full Face, Forehead, Eyes, Cheeks, Nose, Lips, Jawline, **Chin**, **Neck** (+ Chest, Hands, etc.) | Chin and Neck are first-class; areas can be semicolon-separated (multi-area) |
| **Issue names** | Keyword/slug: `crow's-feet`, `nasolabial-folds`, `ill-defined-jawline` | One row per (Issue, Concern); one issue can have multiple concerns (e.g. ill-defined-jawline → Skin Laxity + Excess Fat) |

---

## Alignment and gaps

1. **Categories**  
   - Dashboard: 3. External: 5 (adds **Skin Laxity**, **Excess Fat**).  
   - We can keep 3 for the main overview and use the 5-category + 8-concern taxonomy for filters, reporting, or LLM payloads by deriving them from the mapping.

2. **Issue name matching**  
   - Dashboard uses display names; CSV uses slugs. We need a **display name ↔ slug** mapping (or a single canonical key) so that:
     - Airtable "Name (from All Issues)" can be looked up in the CSV to get Concern(s), General Category, and Areas.
   - `issueToConcernMapping.ts` provides this: it maps dashboard display names to the CSV issue key and exposes Concern, General Category, and Areas.

3. **Areas**  
   - Dashboard uses **Skin** for full-face/skin issues; external uses **Full Face**.  
   - Dashboard folds Chin and Neck into **Jawline**; external has **Chin** and **Neck**.  
   - The mapping layer can expose external areas (e.g. Chin, Neck) for display or API while we keep grouping under Jawline in the UI if desired.

4. **Multi-concern / multi-area**  
   - External mapping supports one issue → multiple concerns and multiple areas. The dashboard currently uses one category/area per issue. The mapping layer allows future use of multi-concern and multi-area (e.g. for filters or richer prompts).

---

## How the mapping is used in code

- **`src/config/issueToConcernMapping.ts`** (added):
  - Embeds the CSV-derived data (issue slug → concern, general category, areas).
  - Maps **dashboard display names** (as in CATEGORIES/AREAS) to the CSV **Issue** key.
  - Exposes:
    - `getConcernMapping(displayName: string)`: returns `{ concernId, concernName, generalCategory, areas[] } | null`.
    - Optional: `getAllConcernMappingsForDisplayNames(displayNames: string[])` for batch lookups.
  - **analysisOverviewConfig.ts** is unchanged; this is an additive layer. We can later:
    - Feed General Category / Concern into LLM prompts.
    - Add a 5-category view or filters.
    - Sync or validate AREAS/CATEGORIES against the CSV.

---

## Recommendation

- **Yes**, the two mapping files (ISSUE_TO_CONCERN_MAPPING.md and issue-to-concern-mapping.csv) are useful to better define and extend the framework:
  - **Single source of truth** for issue → concern → category → areas.
  - **Consistency** with the skin-type-react app and any Airtable/CSV exports.
  - **Richer taxonomy** (5 categories, 8 concerns, multi-area) without breaking the current 3-category overview.
- Keep existing dashboard structure; add the mapping layer and use it where we want concern/category/area from the external taxonomy (e.g. prompts, filters, or future 5-category mode).
