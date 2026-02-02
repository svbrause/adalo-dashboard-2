# Backend / Airtable changes for New Lead, Requested Consult, and Redeemed Offers

This doc describes the backend and Airtable changes needed for the new lead stage labels, **Requested Consult** status, and **Redeemed Offers** (coupon + expiration + mark as redeemed) on Web Popup Leads.

---

## 1. Lead stage label (no backend change)

- **"New Client"** was renamed to **"New Lead"** in the dashboard UI only (filters, dropdowns, Kanban column).
- Airtable can keep using the same **Status** value (e.g. `"New"`). The frontend maps it to the "New Lead" label. No backend or Airtable change required for this.

---

## 2. New lead state: **Requested Consult**

### Airtable (Web Popup Leads and/or Patients)

- **Status** field must accept a new option: **`Requested Consult`** (or equivalent, e.g. `"Requested consultation"`).
- The dashboard sends **`Status: "Requested Consult"`** when a lead is moved to the "Requested Consult" stage.
- Add **"Requested Consult"** as a select option in the **Status** field (single-select) for:
  - **Web Popup Leads** table
  - **Patients** table (if you use lead stage there too).

### Backend API

- **PATCH** (or equivalent) that updates a lead/patient record by `recordId` and `tableName` must allow writing **Status** = `"Requested Consult"`.
- No new endpoints are required; the existing update-record flow (e.g. `/api/dashboard/records/:tableName/:recordId` or your update-lead endpoint) should accept this value like any other status.
- If the backend or Airtable automations filter on **Status** by exact string, update those to include **"Requested Consult"** where needed.

---

## 3. Redeemed Offers (Web Popup Leads)

The dashboard shows a **Redeemed Offers** section for Web Popup Leads with:

- Coupon text: **$50 off**
- **Expiration date** (from Airtable)
- **Mark as redeemed** → sets **Offer Claimed** = true

### Airtable – Web Popup Leads table

1. **Offer Expiration** (or **Offer Expiration Date** / **Coupon Expiration**)
   - Type: **Date** (or formula/rollup if you prefer).
   - Used to show “Expires &lt;date>” in the Redeemed Offers card.
   - The frontend looks for (in order):  
     `Offer Expiration` → `Offer Expiration Date` → `Coupon Expiration`.
   - Use one of those names, or add the same name in the client mapper in code.

2. **Offer Claimed** (existing or new)
   - Type: **Checkbox** (recommended) or a field that can be set to true when “Mark as redeemed” is clicked.
   - The dashboard already sends **`Offer Claimed: true`** when the user clicks **Mark as redeemed**.
   - If this field doesn’t exist yet, add it as a checkbox.

3. Optional: **Offer** / **Coupon** (text)
   - If you want to show different text than “$50 off” per lead, add a text field (e.g. **Offer** or **Coupon**) and the frontend can be extended to read it. Right now the UI shows a fixed “$50 off”.

### Backend API

- The same **PATCH** (or update-record) endpoint used for lead/patient updates must:
  - Accept **Offer Claimed** and persist it to the Web Popup Leads record (e.g. set checkbox to true).
  - If you add **Offer Expiration** (or one of the names above), the backend must either:
    - Expose it in the same “get lead” response that the dashboard uses (so the frontend can show “Expires &lt;date>”), or
    - Ensure the existing lead/record response already returns that field from Airtable (no extra backend change if the API just passes through Airtable fields).
- No new endpoints are required; only support for the new/updated fields on the existing **get lead** and **update lead** flows.

---

## Summary checklist

| Item                         | Where         | Action                                                                                                                     |
| ---------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| "New Lead" label             | Frontend only | Done in dashboard; no backend change.                                                                                      |
| **Requested Consult** status | Airtable      | Add **"Requested Consult"** as an option to **Status** (Web Popup Leads and Patients if used).                             |
| **Requested Consult** status | Backend       | Ensure update-record accepts **Status: "Requested Consult"** and any automations include it.                               |
| **Offer Claimed**            | Airtable      | Ensure **Offer Claimed** (checkbox) exists on Web Popup Leads; backend already sends it.                                   |
| **Offer Expiration**         | Airtable      | Add **Offer Expiration** (or **Offer Expiration Date** / **Coupon Expiration**) date field on Web Popup Leads.             |
| **Offer Expiration**         | Backend       | Ensure get-lead (and any list-leads) response includes the expiration field so the dashboard can show “Expires &lt;date>”. |

After these are in place, the dashboard will:

- Show “New Lead” instead of “New Client” for the first stage.
- Support moving leads to “Requested Consult” and persisting it.
- Show the $50 off coupon and expiration in Redeemed Offers and allow marking the offer as redeemed.
