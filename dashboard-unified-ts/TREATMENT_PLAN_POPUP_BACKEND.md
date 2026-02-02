# Backend Setup for “Treatment Plan” / Treatments Discussed Popup

## Where the popup writes (no change to Treatment Plan Items)

The **Treatment Plan Items** table (your CSV) is **not** used by the new popup. It’s a separate catalog of suggested treatments linked to patients.

The popup reads and writes a **single field on the Lead or Patient record** in your **Leads/Patients** Airtable base (the same base that has **Web Popup Leads** and **Patients**).

---

## What you need in Airtable

### Base: same as Web Popup Leads & Patients

On the base that already has **Web Popup Leads** and **Patients**:

1. **Add one field** to **both** tables (or at least to every table the dashboard uses for “clients”):
   - **Field name:** `Treatments Discussed`  
     (The app also accepts `Discussed Treatments` if you prefer that name.)
   - **Field type:** **Long text**

2. The app stores a **JSON string** in that field, for example:
   ```json
   [
     {
       "id": "abc-123",
       "interest": "Fade Scars",
       "treatment": "Laser treatment",
       "brand": "",
       "region": "",
       "timeline": "Next visit",
       "notes": ""
     }
   ]
   ```
   So the field must be able to hold long text (multi-line is fine).

No other schema changes are required. You do **not** need to change the **Treatment Plan Items** table or its schema.

---

## Backend API (already in place)

The dashboard calls your update-record API with:

- **recordId:** the Airtable record ID of the lead/patient
- **tableName:** `"Web Popup Leads"` or `"Patients"`
- **fields:** `{ "Treatments Discussed": "<JSON string of the array>" }`

Your existing **airtable-update-record** (or **dashboard/update-record**) serverless function that PATCHes arbitrary `fields` to an Airtable record is sufficient. No backend code changes are required **if** that API:

- Accepts `recordId`, `tableName`, and `fields` in the request body
- Sends a PATCH to Airtable with those `fields`

The dashboard sends **PATCH** for this call (partial update); no backend code changes are required.

---

## Does it work for both Patients and Web Popup Leads?

Yes. The popup uses the **client’s table source** when saving:

- For a row from the **Patients** table, it PATCHes that record in **Patients** (`tableName: "Patients"`).
- For a row from **Web Popup Leads**, it PATCHes that record in **Web Popup Leads** (`tableName: "Web Popup Leads"`).

So the same flow works for both. Add the **Treatments Discussed** field to **both** tables so that saving works regardless of whether the client came from Patients or Leads.

---

## Summary

| What                           | Action                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Treatment Plan Items** table | **No change.** Popup does not read or write this table.                                                     |
| **Web Popup Leads** table      | Add field **Treatments Discussed** (Long text).                                                             |
| **Patients** table             | Add field **Treatments Discussed** (Long text).                                                             |
| **Backend**                    | No schema change. Ensure update-record API accepts the field and uses the same base as your Leads/Patients. |

After adding **Treatments Discussed** (or **Discussed Treatments**) as a Long text field on the Leads and Patients tables, the popup will save and load the treatment plan for each client correctly.
