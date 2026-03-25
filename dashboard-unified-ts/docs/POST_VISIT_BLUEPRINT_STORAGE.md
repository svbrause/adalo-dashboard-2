# Post-Visit Blueprint short links (`?t=` only)

Short SMS links load the full JSON from **`GET /api/dashboard/blueprint?token=`** on your backend. That must be **durable** (not only in-memory) so private/incognito and new devices work without `localStorage`.

## Option A — Files (default)

If **`POST_VISIT_BLUEPRINT_TABLE`** is **not** set, blueprints are written under:

- `data/post-visit-blueprints/<token>.json` (relative to the server process cwd), or  
- **`POST_VISIT_BLUEPRINT_DATA_DIR`** if set.

Works well for a **long-lived Node** process (local dev, Fly.io, Railway, a VPS). **Does not persist** on typical **Vercel** serverless (ephemeral filesystem).

## Option B — Airtable (recommended for Vercel)

1. Create a base table, e.g. **`Post Visit Blueprints`**.
2. Add fields:
   - **`Token`** — Single line text  
   - **`Bundle`** — Long text (stores JSON wrapper; ~100k character limit)
   - **Recommended:** **`Patient`** (or any name) — **Link to another record** → **Patients**  
     Lets you see which blueprint belongs to whom, build rollups on the patient record, and avoid orphaned rows.

3. Set env on the backend:

```bash
POST_VISIT_BLUEPRINT_TABLE=Post Visit Blueprints
# Exact Airtable field name for the link column (omit if you skip the link):
POST_VISIT_BLUEPRINT_PATIENT_LINK_FIELD=Patient
```

If you send blueprints for **Web Popup Leads**, that link field must point to the **Web Popup Leads** table (same record id as `patient.id` in the payload), not Patients.

4. Redeploy. On boot you should see:  
   `Post-Visit Blueprints → Airtable table "Post Visit Blueprints"`

### Stored payload

- **`frontPhotoDataUrl`** is **removed** before save (keeps size under Airtable limits). The patient page still uses **`frontPhoto`** plus **`GET /api/dashboard/blueprint/front-photo`** when needed.
- If the bundle is still too large, the API may strip **`analysisSummary.overviewSnapshot.aiNarrative`** or return **413**.

## TTL

- Default **120 days** after save. Override: **`POST_VISIT_BLUEPRINT_TTL_DAYS`**.

## Dashboard

- **`VITE_BACKEND_API_URL`** must point at this API so **`POST /api/dashboard/blueprint`** succeeds when sending the blueprint (short link in SMS).
