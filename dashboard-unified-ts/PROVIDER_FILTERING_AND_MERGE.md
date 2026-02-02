# How patients are filtered by provider (and merging two providers)

## Merged providers (TheTreatment250 + TheTreatment447)

**Goal:** Log in with either `TheTreatment250` or `TheTreatment447` and see **all patients from both** providers.

**Frontend (done):** The dashboard supports a `mergedProviderIds` field on the provider object. When the backend returns it, the dashboard passes a comma-separated list of provider IDs to the leads and contact-history APIs and to photo loading, so records linked to **any** of those IDs are included.

**Backend (required):**

1. **Provider lookup** (`GET /api/dashboard/provider?providerCode=TheTreatment250` or `...=TheTreatment447`):
   - For codes that are in the same “merge group” (e.g. TheTreatment250 and TheTreatment447), return the **same** provider object and set **`mergedProviderIds`** to **both** provider Airtable record IDs.
   - Example:  
     `{ provider: { id: "rec250", code: "TheTreatment250", name: "...", mergedProviderIds: ["rec250", "rec447"] } }`
   - When the user logs in with TheTreatment447, return the same shape with both IDs (e.g. `id: "rec447"`, `mergedProviderIds: ["rec250", "rec447"]`). The frontend uses `mergedProviderIds` when present, so both logins see the same combined list.

2. **Leads/patients** (`GET /api/dashboard/leads?tableName=Patients&providerId=rec250,rec447`):
   - When **`providerId`** contains a comma, treat it as multiple IDs (e.g. split on `,`).
   - Return records that are linked to **any** of those provider IDs (OR), not just one.

3. **Contact history** (`GET /api/dashboard/contact-history?tableSource=Patients&providerId=rec250,rec447`):
   - Same as above: accept comma-separated **`providerId`** and return contact history for records linked to **any** of those IDs.

Once the backend does the above, logging in with either code will show all patients from both TheTreatment250 and TheTreatment447.

---

## How provider filtering works (single provider)

1. **Login**  
   The user enters a **provider code** (e.g. `TheTreatment250`). The frontend calls:
   - `GET /api/dashboard/provider?providerCode=TheTreatment250`  
     The backend returns a single **provider** object that includes `id` (the Airtable record ID of that Providers row).

2. **Data fetching**  
   All patient/lead data is then requested using that **provider ID**, not the code:
   - `GET /api/dashboard/leads?tableName=Web%20Popup%20Leads&providerId=<provider.id>`
   - `GET /api/dashboard/leads?tableName=Patients&providerId=<provider.id>`
   - Contact history is also requested with the same `providerId`.

3. **Backend behavior**  
   The backend (e.g. `ponce-patient-backend`) uses `providerId` to filter Airtable records. Typically:
   - **Web Popup Leads** and **Patients** have a link field to the **Providers** table (e.g. "Providers" or "Record ID (from Providers)").
   - Only records **linked to that provider** are returned.

So: **provider code → one provider record → one `provider.id` → all filtering is by that ID.**

---

## Merging two providers so both codes see the same patients

Goal: when someone logs in with **either** `TheTreatment250` or `TheTreatment447`, they see the **same merged** set of patients.

### Option A: One provider record with both codes in `Code` (depends on backend)

- In Airtable **Providers** table, use **one** row as the merged provider.
- Set **Code** to something like: `TheTreatment250, TheTreatment447` (or two separate columns if your backend supports that).
- **Link all patients** from both old providers to this **single** provider record (so this row’s ID is the one used for filtering).

Then it comes down to how the backend looks up the provider:

- **If the backend matches Code by substring or “contains”**  
  Example: `FIND(requestedCode, {Code}) > 0` or “code is one of the comma‑separated values”.  
  Then:
  - Login with `TheTreatment250` → backend finds this provider → returns its `id`.
  - Login with `TheTreatment447` → same provider → same `id`.
  - Leads/patients are filtered by that one `providerId`, so both codes see the same merged list.

- **If the backend does exact match on Code**  
  Then `TheTreatment250` would not match `TheTreatment250, TheTreatment447`. You’d need a **backend change** so that:
  - Provider lookup treats `Code` as comma‑separated (e.g. “match if requested code equals any of these”), and
  - Returns the same provider record for both codes.

So: **Yes, having both codes in one field (e.g. `Code = "TheTreatment250, TheTreatment447"`) can work, but only if the backend’s provider-by-code lookup is implemented to treat that as “either code matches this provider.”**

### Option B: Backend supports multiple provider IDs

- Backend could accept multiple provider codes (or one code that maps to multiple provider IDs) and return leads/patients linked to **any** of those IDs.
- That would require backend (and possibly frontend) changes; the current dashboard only sends a single `providerId`.

---

## What to do in Airtable

1. **Providers table**
   - Either:
     - One row with **Code** = `TheTreatment250, TheTreatment447` (if backend supports “match if code is one of these”), or
     - Keep two rows but change the backend to resolve both codes to the same merged list (e.g. same `providerId` or multiple IDs).

2. **Web Popup Leads & Patients**
   - For Option A, **link every lead/patient** that should be visible to the merged provider to that **one** Providers record (the one whose Code contains both codes).
   - Otherwise they won’t be returned when filtering by that provider’s ID.

---

## Summary

- **Filtering:** By **provider ID** (Airtable record ID of the Providers row). The code is only used at login to get that ID.
- **Merging with a single Code value:**
  - Set **Code** to e.g. `TheTreatment250, TheTreatment447` on **one** provider row.
  - Link all relevant patients/leads to that row.
  - Ensure the **backend** provider lookup treats that field as “either code” (e.g. comma‑separated or contains).  
    If the backend does exact match on Code, you need a backend change so both codes resolve to that same provider record.
