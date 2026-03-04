# Treatment Recommender Custom Options – Airtable & Backend

Users can add custom “Where” / “What” options on the treatment recommender (e.g. custom regions, skincare products, laser devices, biostimulant products). Those options are persisted in Airtable and loaded on the next visit.

## Airtable: table for custom options

Create a table in the same base used by the dashboard (or a base the backend can read/write).

**Suggested table name:** `Treatment Recommender Options` (or `Recommender Custom Options`).

| Field name     | Airtable type   | Description |
|----------------|-----------------|-------------|
| **Option Type** | Single select   | One of: `Where`, `Skincare What`, `Laser What`, `Biostimulant What`. Backend can map to: `where`, `skincare_what`, `laser_what`, `biostimulant_what`. |
| **Value**       | Single line text| The option label (e.g. "Custom Region", "Custom Product"). |
| **Provider Id** | Single line text (optional) | Provider record ID so options can be scoped per provider. |

- **Option Type** single-select values should match what the backend expects (e.g. exactly `Where`, `Skincare What`, `Laser What`, `Biostimulant What`, or the snake_case equivalents).
- **Provider Id** is sent by the frontend on create and used for filtering on read.

## Backend API contract

Base URL: same as existing dashboard API (e.g. `BACKEND_API_URL`).

### GET – list custom options

- **URL:** `GET /api/dashboard/treatment-recommender-options?providerId={providerId}`
- **Response:** JSON with either:
  - `records`: array of Airtable-style records `{ id, fields: { "Option Type", "Value", "Provider Id" } }`, or
  - `options`: array of `{ id, optionType, value }` with `optionType` one of `where`, `skincare_what`, `laser_what`, `biostimulant_what`.

The frontend normalizes both shapes. Filter by `Provider Id` when the table has that field.

### POST – create a custom option

- **URL:** `POST /api/dashboard/treatment-recommender-options`
- **Body:** `{ "providerId": string, "optionType": "where" | "skincare_what" | "laser_what" | "biostimulant_what", "value": string }`
- **Response:** JSON with the created record, e.g.:
  - `record`: Airtable record `{ id, fields: { "Option Type", "Value", "Provider Id" } }`, or
  - Direct object `{ id, optionType, value }`.

The frontend uses the returned `id` and `value` to show the new option in the UI. Deduplication (e.g. same `value` + `optionType` + `providerId`) can be handled in the backend or Airtable (e.g. allow duplicates and dedupe on read).

## Frontend usage

- **Load:** On opening the treatment recommender, the app calls `fetchTreatmentRecommenderCustomOptions(providerId)` and merges results with static options (Where = regions, What = skincare/laser/biostimulant lists).
- **Add:** When the user types a new option and clicks “Add”, the app updates local state and calls `createTreatmentRecommenderCustomOption(providerId, optionType, value)`. On success, the new option is kept in local state and will appear in the merged list on future loads.

See `src/services/api.ts` for `fetchTreatmentRecommenderCustomOptions` and `createTreatmentRecommenderCustomOption`.
