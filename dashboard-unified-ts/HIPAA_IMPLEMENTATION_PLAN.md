# HIPAA Implementation Plan — Dashboard + Patient App

> **Disclaimer:** This is an engineering and program execution plan, not legal advice. Engage qualified legal and compliance counsel at every major checkpoint, especially before claiming compliance to clients or patients.

---

## Table of Contents

1. [Program Overview](#1-program-overview)
2. [HIPAA Requirements Reference and How We Address Each](#2-hipaa-requirements-reference-and-how-we-address-each)
3. [Vendor-by-Vendor Decision Matrix](#3-vendor-by-vendor-decision-matrix)
4. [Vendor Outreach and Negotiation Playbook](#4-vendor-outreach-and-negotiation-playbook)
5. [4-Week Accelerated Implementation Timeline](#5-4-week-accelerated-implementation-timeline)
6. [Backend Route Security Matrix](#6-backend-route-security-matrix)
7. [Frontend Changes Required](#7-frontend-changes-required)
8. [Authentication Architecture — Firebase Approach](#8-authentication-architecture--firebase-approach)
9. [Audit Logging Design](#9-audit-logging-design)
10. [Operational Readiness Checklist](#10-operational-readiness-checklist)
11. [Success Criteria and Go-Live Gates](#11-success-criteria-and-go-live-gates)

---

## 1. Program Overview

### What This System Handles Today

- **Dashboard frontend** (`dashboard-unified-ts-merged`): Staff access patient/lead records, treatment plans, SMS, analysis, photos.
- **Backend API** (`ponce-patient-backend` on Vercel): Express routes proxying Airtable reads/writes, OpenPhone SMS, blueprint storage on GCS, AI assessment via Gemini/Google Cloud, skin quiz, booking intents.
- **Patient-facing routes**: Public token-gated post-visit blueprints, skin quiz standalone page, shared treatment plan links.
- **Analytics**: PostHog session recording with `identify()` calls.
- **Automations**: Zapier connecting Airtable → OpenPhone (SMS Notifications table).
- **Notifications**: Slack login notifications; Brevo (email); OpenPhone (SMS).

### PHI Surfaces Identified

The following types of PHI are in scope:

- Patient name, phone, email, date of birth, zip code
- Treatment discussions, analysis notes, skin quiz results
- Provider-assigned clinical notes and goals
- Photo attachments (front/side clinical photos)
- Appointment/visit context embedded in blueprints and SMS messages
- Session/analytics identifiers when tied to health-related activity

### Key Risks Today (Pre-Compliance)

| Risk | Location |
|------|----------|
| Shared provider-code login (no individual accountability) | `ProviderLoginScreen.tsx`, `providerStorage.ts` |
| Generic PATCH/query API with no auth or field scoping | `PATCH /api/dashboard/update-record`, `GET /api/dashboard/records/:tableName` |
| PostHog session recording active with provider `identify()` | `main.tsx`, `App.tsx` |
| Brevo used for email — no BAA offered | `smsSettingsCatalog.ts`, email flows |
| Zapier automations pass PHI (name/phone) without BAA | SMS Notifications table → OpenPhone Zap |
| Slack receives login/event metadata | `notifyLoginToSlack()` in `api.ts` |
| Provider info, blueprint payloads stored in `localStorage` | `providerStorage.ts`, `postVisitBlueprint.ts` |
| Debug routes enabled in production build | `App.tsx` `/debug/*` routes |
| No audit trail for who read/modified a patient record | All backend handlers |
| Airtable base not on HIPAA-eligible plan | All Airtable access |

---

## 2. HIPAA Requirements Reference and How We Address Each

HIPAA applies three sets of safeguards: Administrative (§164.308), Physical (§164.310), and Technical (§164.312), plus the Privacy Rule and Breach Notification Rule. Below is every applicable standard with our implementation approach.

> **R** = Required implementation specification. **A** = Addressable (must implement or document equivalent).

---

### 2.1 Administrative Safeguards (§164.308)

#### 2.1.1 Security Management Process — §164.308(a)(1)

| Specification | Type | Our Implementation |
|---|---|---|
| **Risk Analysis** | R | Conduct formal risk assessment mapping threats to PHI across all systems. Document likelihood and impact. Revisit annually or after major changes. |
| **Risk Management** | R | Build and maintain risk register with mitigations for each identified risk. Track closure via this plan. |
| **Sanction Policy** | R | Written policy defining consequences for workforce members who violate HIPAA policies. Legal counsel drafts; HR enforces. |
| **Information System Activity Review** | R | Implement structured audit logs (see §9) that are reviewed on a schedule (weekly automated alerts, monthly manual review). |

**Implementation tasks:**
- [ ] Engage legal counsel to produce a risk analysis document using NIST 800-30 or HHS SRA Tool.
- [ ] Create risk register in a trackable format with owner, mitigation, and due date for each item.
- [ ] Draft sanction policy and get HR/legal sign-off.
- [ ] Design and deploy audit log schema (see Section 9). Set up alerting in Vercel log drain or a logging service (e.g. Logtail, Axiom, or Google Cloud Logging under GCP BAA).

---

#### 2.1.2 Assigned Security Responsibility — §164.308(a)(2)

| Specification | Type | Our Implementation |
|---|---|---|
| **Security Official** | R | Designate one named individual as HIPAA Security Officer. |

**Implementation tasks:**
- [ ] Formally designate Security Officer (document name, date, responsibility scope).
- [ ] Designate Privacy Officer (may be same person at this stage).

---

#### 2.1.3 Workforce Security — §164.308(a)(3)

| Specification | Type | Our Implementation |
|---|---|---|
| **Authorization / Supervision** | A | All staff who touch PHI must have explicit role-based access provisioned via Firebase Auth custom claims (see Section 8). |
| **Workforce Clearance** | A | Document who is cleared to access which data. Checklist for each provider/staff onboarding. |
| **Termination Procedures** | A | Disable Firebase account, revoke Airtable access, revoke OpenPhone/Quo access, rotate any shared API keys, within 24h of offboarding. |

**Implementation tasks:**
- [ ] Create access provisioning form and deprovisioning checklist.
- [ ] Document role → data access mapping (provider admin, provider staff, super-admin).
- [ ] Create offboarding runbook (linked to HR process).

---

#### 2.1.4 Information Access Management — §164.308(a)(4)

| Specification | Type | Our Implementation |
|---|---|---|
| **Access Authorization** | A | Firebase custom claims carry `providerId` and `role`. Backend verifies on every request. Staff can only read/write their own provider's records. |
| **Access Establishment and Modification** | A | Admin provisioning flow creates Firebase user and assigns correct claims. Re-run when role changes. |

**Implementation tasks:**
- [ ] Define Firebase custom claims schema: `{ providerId, role: "admin" | "staff" | "super-admin" }`.
- [ ] Add `verifyFirebaseToken(req)` middleware to all dashboard routes.
- [ ] Scope all Airtable queries with `filterByFormula` using the verified `providerId` from the token.

---

#### 2.1.5 Security Awareness and Training — §164.308(a)(5)

| Specification | Type | Our Implementation |
|---|---|---|
| **Security Reminders** | A | Periodic email/Slack reminders about PHI handling policies. Quarterly minimum. |
| **Malicious Software Protection** | A | Policy requiring staff to run endpoint AV; no PHI on personal devices without MDM. |
| **Log-in Monitoring** | A | Automated alerts on failed logins, suspicious access patterns (implemented in audit log layer). |
| **Password Management** | A | Firebase Auth enforces no passwords — MFA + email/Google SSO required. |

**Implementation tasks:**
- [ ] Create staff training document covering PHI basics, system access rules, incident reporting.
- [ ] Implement training completion tracking (e.g. a simple form or dedicated tool).
- [ ] Set up login anomaly alerts in Firebase Auth console or via audit log monitoring.

---

#### 2.1.6 Security Incident Procedures — §164.308(a)(6)

| Specification | Type | Our Implementation |
|---|---|---|
| **Response and Reporting** | R | Written incident response plan with defined steps: detect → contain → assess → notify → remediate → document. |

**Implementation tasks:**
- [ ] Draft incident response runbook (see Section 10).
- [ ] Establish escalation contacts: Security Officer → Legal Counsel → covered entity partners.
- [ ] Document breach notification timelines (60 days to HHS, without unreasonable delay to individuals).
- [ ] Set up a private incident log (not in the same system as PHI).

---

#### 2.1.7 Contingency Plan — §164.308(a)(7)

| Specification | Type | Our Implementation |
|---|---|---|
| **Data Backup Plan** | R | Airtable Enterprise has built-in snapshots. Supplement with periodic exports to encrypted GCS bucket under GCP BAA. |
| **Disaster Recovery Plan** | R | Vercel redeploy from Git. Airtable restore from snapshot. GCS blueprint recovery procedure documented. |
| **Emergency Mode Operation** | R | Define which operations can continue if primary systems are unavailable. Document minimal-access fallback. |
| **Testing and Revision** | A | Test restore procedure at least annually. |
| **Data Criticality Analysis** | A | Rank data assets: Patients table > Web Popup Leads > Blueprints > Logs. |

**Implementation tasks:**
- [ ] Set up weekly Airtable export script to encrypted GCS bucket (service account with narrow permissions).
- [ ] Document disaster recovery steps and test Vercel redeployment.
- [ ] Write emergency access procedure for Security Officer.

---

#### 2.1.8 Evaluation — §164.308(a)(8)

| Specification | Type | Our Implementation |
|---|---|---|
| **Periodic Technical and Non-Technical Evaluation** | R | Annual security review; immediate review after major changes. |

**Implementation tasks:**
- [ ] Calendar annual HIPAA review (risk analysis refresh, vendor review, control testing).
- [ ] Document current state as baseline after this implementation.

---

#### 2.1.9 Business Associate Contracts — §164.308(b)(1)

| Specification | Type | Our Implementation |
|---|---|---|
| **BAA with each Business Associate** | R | Every vendor that creates, receives, maintains, or transmits PHI on our behalf must have a signed BAA. See Section 3 and 4 for vendor-specific actions. |

---

### 2.2 Physical Safeguards (§164.310)

Physical safeguards apply primarily to on-premises infrastructure. Since this system runs on cloud services (Vercel, Google Cloud, Airtable), physical controls are largely inherited from those vendors under their BAAs.

| Standard | Our Implementation |
|---|---|
| **Facility Access Controls** §164.310(a)(1) | Inherited from Vercel and GCP data center controls under their BAAs. No on-prem servers. |
| **Workstation Use** §164.310(b) | Policy: PHI may only be accessed on managed/approved devices. Personal devices require MDM enrollment or are prohibited from PHI access. |
| **Workstation Security** §164.310(c) | Policy: screens lock after 5 min inactivity; full-disk encryption required (FileVault on macOS, BitLocker on Windows). |
| **Device and Media Controls** §164.310(d)(1) | Policy: no PHI downloaded to local device without explicit approval. PHI on USB/removable media prohibited. Remote wipe capability required. |

**Implementation tasks:**
- [ ] Draft and distribute acceptable use and device policy.
- [ ] Confirm cloud providers' physical controls in their BAA documentation (Vercel, GCP/Airtable).
- [ ] Document that no on-prem servers are in scope.

---

### 2.3 Technical Safeguards (§164.312)

#### 2.3.1 Access Control — §164.312(a)(1)

| Specification | Type | Our Implementation |
|---|---|---|
| **Unique User Identification** | R | Each staff member gets an individual Firebase Auth UID. No shared accounts. Provider codes are retired for dashboard access. |
| **Emergency Access Procedure** | R | Security Officer has super-admin Firebase role and can access any record in a documented emergency. All emergency access is audit-logged. |
| **Automatic Logoff** | A | Firebase ID tokens expire in 1 hour. Frontend detects expiration and logs out. Inactive sessions expire after 30 minutes of inactivity (implemented via `setTimeout` + token check). |
| **Encryption and Decryption** | A | All data at rest in Airtable Enterprise encrypted (AES-256). GCS buckets encrypted. Vercel environment variables encrypted at rest. No plaintext PHI in `localStorage` in production. |

**Implementation tasks:**
- [ ] Implement Firebase Auth (see Section 8).
- [ ] Add token expiry check and idle timeout to frontend (`App.tsx`).
- [ ] Confirm Airtable Enterprise encryption at rest in BAA documentation.
- [ ] Remove/encrypt PHI from `localStorage` (provider info, blueprint cache).

---

#### 2.3.2 Audit Controls — §164.312(b)

| Specification | Type | Our Implementation |
|---|---|---|
| **Record and examine activity** | R | Structured audit log on every backend route that touches PHI. Log: `userId`, `providerId`, `action`, `resource` (table + recordId), `timestamp`, `ip`, `outcome`. Logs shipped to immutable store (GCP Cloud Logging under BAA, or Axiom). |

**Implementation tasks:**
- [ ] Design audit log schema and middleware (see Section 9).
- [ ] Ship logs to external immutable store.
- [ ] Set retention policy (minimum 6 years for HIPAA).
- [ ] Create weekly audit log review process.

---

#### 2.3.3 Integrity — §164.312(c)(1)

| Specification | Type | Our Implementation |
|---|---|---|
| **Mechanism to Authenticate ePHI** | A | Airtable maintains record version history under Enterprise. Backend validates record IDs against expected table before update. Blueprint tokens are UUIDs and are bound to patient ID at save time. |

**Implementation tasks:**
- [ ] Validate `patientId` against `token` on blueprint read routes.
- [ ] Ensure backend `update-record` refactor verifies record ownership before writing.
- [ ] Document reliance on Airtable Enterprise audit/version history.

---

#### 2.3.4 Person or Entity Authentication — §164.312(d)

| Specification | Type | Our Implementation |
|---|---|---|
| **Verify identity before granting access** | R | Firebase Auth tokens required on all dashboard API calls. MFA enforced for all staff accounts via Firebase Multi-Factor Auth or Google Workspace SSO with MFA. |

**Implementation tasks:**
- [ ] Enforce MFA enrollment as a pre-condition for accessing dashboard (Firebase or enforced at IdP level).
- [ ] Backend middleware rejects any request with missing or invalid Firebase ID token.

---

#### 2.3.5 Transmission Security — §164.312(e)(1)

| Specification | Type | Our Implementation |
|---|---|---|
| **Integrity Controls** | A | TLS 1.2+ enforced on all routes (Vercel default). Backend-to-Airtable calls use HTTPS. Backend-to-OpenPhone calls use HTTPS. |
| **Encryption in Transit** | A | HSTS enforced on Vercel production domain. No HTTP fallback. No PHI in URL query strings (move to POST bodies where currently in GET params). |

**Implementation tasks:**
- [ ] Audit all routes where PHI (email, patient ID) is in query params — move to POST body or header.
- [ ] Confirm Vercel HSTS headers are set for production domain.
- [ ] Confirm Airtable, OpenPhone, PostHog (if retained), GCS calls all use HTTPS.

---

### 2.4 Privacy Rule Highlights (§164.500–164.534)

| Standard | Our Implementation |
|---|---|
| **Minimum Necessary** §164.502(b) | Dashboard list views already use field-restricted Airtable queries. Extend to all detail/update calls. Backend routes only return fields needed for the requested operation. |
| **Notice of Privacy Practices** §164.520 | If this system is used by a Covered Entity (e.g. clinic), that entity must maintain an NPP for patients. If we operate as a Business Associate, we support their NPP obligations. Confirm with counsel. |
| **Patient Access Rights** §164.524 | Covered Entity must provide mechanism for patient records access requests. Coordinate with CE partners. |
| **Amendment** §164.526 | CE must provide mechanism to amend inaccurate records. |
| **Accounting of Disclosures** §164.528 | Audit logs satisfy this when structured correctly. |
| **Safeguarding PHI** §164.530(c) | All controls in this plan serve this obligation. |

---

### 2.5 Breach Notification Rule (§164.400–164.414)

| Requirement | Our Implementation |
|---|---|
| **Notification to Individual** within 60 days of discovery | Incident response runbook includes patient/individual notification template and timing checklist. |
| **Notification to HHS** | Annual summary if small breaches; within 60 days if large (>500 individuals in a state). Security Officer owns this. |
| **Notification to Media** if >500 individuals in a state | Included in breach runbook. |
| **Breach Risk Assessment** | 4-factor test: nature of PHI, who accessed, whether PHI was actually acquired, extent of mitigation. Document for every potential incident. |

---

## 3. Vendor-by-Vendor Decision Matrix

| Vendor | Current PHI Exposure | BAA Available | Plan Required | Action | Priority |
|--------|----------------------|---------------|---------------|--------|----------|
| **Airtable** | PRIMARY — all patient/lead records, treatment data, photos, blueprints | YES — Enterprise Scale only | Enterprise Scale | Upgrade + negotiate + sign BAA | CRITICAL — Week 1 |
| **Vercel** | Backend runtime — all API traffic, env vars with API keys | YES — Pro + paid BAA add-on | Pro (at minimum) | Add BAA add-on or upgrade | CRITICAL — Week 1 |
| **Google Cloud Platform / GCP** | Blueprint GCS bucket, TTS, Gemini/Vertex AI | YES — via GCP BAA for covered services | Any paid | Execute GCP BAA; confirm each service is on covered list | CRITICAL — Week 1 |
| **Firebase Auth** | Auth tokens; may store email/UID | YES — Firebase is under GCP BAA for eligible services | Any paid | Confirm Firebase Auth is on GCP HIPAA covered service list; execute GCP BAA | HIGH — Week 1-2 |
| **OpenPhone / Quo** | SMS content, patient names/phones | YES — Business or Scale plan | Business or Scale | Upgrade + sign BAA; note SMS itself is not a covered service under their BAA | HIGH — Week 2 |
| **PostHog** | Session recordings, identify() calls with provider email/name | YES — paid add-on tier (Boost/Scale/Enterprise) | Boost ($250/mo) or higher | Option A: BAA + disable replay/sensitive events. Option B: Remove PostHog from PHI builds entirely | HIGH — Week 1 (immediate risk) |
| **Brevo** | Email sends — may include PHI (appointment info, patient names) | NO — does not offer HIPAA BAA | N/A | Replace with HIPAA-eligible email path; stop sending PHI via Brevo immediately | CRITICAL — Week 1 |
| **Zapier** | SMS Notifications automation — passes patient names/phones | NO — explicitly no HIPAA/BAA | N/A | Remove PHI from Zapier automations; replace with in-backend automation or HIPAA-eligible iPaaS | CRITICAL — Week 1 |
| **Slack** | Login notifications (provider name, email metadata) | YES — Enterprise Grid + HIPAA SKU only | Enterprise Grid | Option A: Upgrade (expensive). Option B: Remove PHI from Slack messages (keep only non-PHI internal ops data). Option B is strongly preferred for a small team. | MEDIUM — Week 2 |
| **Google Workspace (Gmail)** | Potential PHI email replacement for Brevo | YES — with BAA via Admin Console | Business Starter+ | Execute BAA + use Gmail API for transactional sends OR add HIPAA-eligible transactional ESP | HIGH — Week 1-2 |
| **Amazon SES (alternative email)** | Potential transactional email path | YES — AWS BAA covers SES | Any AWS paid | If not using Google Workspace path, add AWS account + BAA + SES for transactional PHI email | MEDIUM — alternative to Google |

---

## 4. Vendor Outreach and Negotiation Playbook

### 4.1 Airtable

**Goal:** Sign the Health Information Exhibit (BAA). Avoid full Enterprise Scale pricing if possible.

**Contact path:**
1. Go to [airtable.com/contact-sales](https://airtable.com/contact-sales) or email `enterprise@airtable.com`.
2. Mention you are a healthcare business associate moving toward HIPAA compliance and need HIPAA enterprise terms.

**Negotiation angles:**
- **Team size:** Ask specifically whether HIPAA coverage can be scoped to a small number of seats (e.g. 2-5 users) rather than a minimum that may be 10+ seats. Enterprise plans are often negotiable on seat counts for small teams.
- **Annual vs. monthly:** Ask for monthly billing to start while compliance is implemented, with a path to annual later. Frame as reducing commitment risk during a transition period.
- **Pilot/startup terms:** Ask if there is a healthcare startup or early-stage pricing program.
- **BAA without full Enterprise:** Ask explicitly whether the Health Information Exhibit can be executed on a lower tier with HIPAA-specific add-on pricing, even if features are limited.

**Likely outcome:** Airtable's HIPAA terms are currently Enterprise Scale only. They may negotiate seats but not the tier itself. Be prepared to pay for ~5 seats at Enterprise Scale pricing, or evaluate alternatives like Notion (Business + BAA), a Postgres-backed solution, or a purpose-built healthcare data store.

**Fallback:** If Airtable pricing is prohibitive, evaluate migrating PHI to a self-hosted Postgres or Supabase instance with GCP hosting under the GCP BAA. This is a significant engineering lift but eliminates the Airtable Enterprise cost.

---

### 4.2 PostHog

**Goal:** Either get a BAA at the lowest cost tier, or eliminate PHI from PostHog entirely.

**Contact path:** [posthog.com/baa](https://posthog.com/baa) — they have a self-serve BAA generator. For pricing negotiation, email `privacy@posthog.com` or `sales@posthog.com`.

**Negotiation angles:**
- **Boost add-on** starts at $250/month. Ask if startup/healthcare pricing applies.
- Ask whether event volume can reduce the cost (if usage is low).
- **Alternative framing:** Offer to become a case study or reference customer in exchange for favorable pricing.
- **Best option for many teams:** Simply disable session recording and `identify()` in production and operate PostHog on the free tier for anonymous analytics only (no PHI). This avoids BAA entirely and may be the fastest path.

**Recommended immediate action (before BAA is in place):**
In `main.tsx`, add `disable_session_recording: true` and remove the `identify()` calls with provider email/name from `App.tsx`. This reduces exposure right now without waiting for a contract.

---

### 4.3 Vercel

**Goal:** Execute BAA for the production deployment.

**Contact path:** Vercel's BAA is available as a self-serve add-on in the Vercel dashboard for Pro teams. Go to **Settings → Security** in your Vercel team and look for the HIPAA/BAA add-on, or contact `sales@vercel.com`.

**Negotiation angles:**
- The BAA add-on has a monthly fee. Ask if it can be bundled or discounted if already on Pro.
- If on Hobby plan, upgrade to Pro is required.
- Confirm which regions are covered (Vercel's BAA covers global infrastructure per their documentation).

---

### 4.4 OpenPhone / Quo

**Goal:** Upgrade to Business/Scale plan and sign BAA. Understand that SMS itself is not under the BAA.

**Contact path:** [quo.com/sales](https://quo.com/sales) or existing account team. Existing customers can request BAA at [openphone.typeform.com/to/vAX6Mdaz](https://openphone.typeform.com/to/vAX6Mdaz).

**Negotiation angles:**
- Ask whether a small team (2-3 users) can get Business plan pricing without minimum seat requirements.
- Ask for a monthly billing option while transitioning.
- **Important disclosure to give them:** You are moving to HIPAA compliance and need to ensure the BAA covers your use case. They will confirm SMS is not covered under the BAA but can still be used with patient consent and minimum necessary PHI.

---

### 4.5 Brevo (Replace, Do Not Negotiate for PHI)

Brevo does not offer a HIPAA BAA. Do not negotiate — plan for replacement.

**Immediate action:** Audit every Brevo email flow. Determine which contain PHI (patient names, appointment details, treatment info). Stop sending those via Brevo immediately.

**Replacement options:**
- **Google Workspace + Gmail API** (if already using Google Workspace or willing to add it): Simplest path. Execute BAA via Admin Console. Use Gmail SMTP relay or Gmail API from backend.
- **AWS SES + AWS BAA**: Good for high-volume transactional sends. Requires AWS account and AWS BAA execution.
- **Paubox** (healthcare email): Built specifically for HIPAA; offers encrypted email delivery and BAA. Higher cost but easiest compliance story.

**Transition plan:**
- Non-PHI marketing sends (general newsletters, no patient identifiers): Can remain on Brevo.
- PHI-containing operational sends (appointment confirmations, treatment plans, patient-specific info): Must move to BAA-covered path.

---

### 4.6 Zapier (Replace for PHI Automations)

Zapier does not offer a HIPAA BAA and explicitly states PHI should not flow through it.

**Immediate action:** Identify every Zap that touches PHI. The most critical is the SMS Notifications table → OpenPhone automation.

**Replacement options:**
- **Move automation into the backend:** Instead of Zapier watching the SMS Notifications Airtable table and triggering OpenPhone, have the dashboard backend call OpenPhone directly via `/api/dashboard/sms` (which already exists in the codebase). Remove the Airtable→Zapier→OpenPhone trigger path entirely.
- **Airtable Automations** (if on Enterprise): Airtable has built-in automations under the BAA. Can replace some Zapier flows entirely within Airtable.
- **HIPAA-eligible iPaaS alternatives:** Workato, Tray.io — both offer BAAs but are significantly more expensive. Only consider if you need complex automation beyond what the backend can handle.

**Recommended:** Consolidate automation logic into the backend codebase. This eliminates a vendor dependency and is the most secure pattern.

---

### 4.7 Slack

**Goal:** Stop PHI from flowing to Slack unless you are willing to pay for Enterprise Grid + HIPAA SKU (expensive, likely not worth it for internal notifications).

**Recommended approach:** Keep Slack for internal team communication but make it PHI-free.

**Changes needed:**
- `notifyLoginToSlack()` in `api.ts`: Strip provider email from payload. Send only non-identifying operational data (login event occurred, provider tier, timestamp). Or replace with a private internal log entry.
- Any other Slack notifications: Audit and strip PHI.

**If Enterprise Grid is required:** Contact Slack sales for HIPAA SKU pricing. Expect $12.50+ per user per month + the HIPAA SKU add-on fee. For a small team this may be $500-1000/month. Evaluate necessity carefully.

---

### 4.8 Google Cloud Platform

**Goal:** Execute GCP BAA to cover: GCS (blueprint bucket), Cloud TTS, Vertex AI / Gemini API.

**Contact path:** GCP BAA is self-serve. Go to **IAM & Admin → Account management → HIPAA** in the GCP console, or visit [cloud.google.com/security/compliance/hipaa](https://cloud.google.com/security/compliance/hipaa). Accept the HIPAA Business Associate Addendum electronically.

**Check covered services list:** Confirm each service you use (GCS, Cloud TTS, Vertex AI, Cloud Logging) is on [Google's HIPAA covered services list](https://cloud.google.com/security/compliance/hipaa). Services not on the list cannot process PHI even with a BAA.

**Firebase Auth under GCP BAA:** Firebase Authentication is under the GCP BAA for eligible services. Confirm the specific Firebase products you use are on the covered list before routing PHI through them.

---

## 5. 4-Week Accelerated Implementation Timeline

> **Assumption:** Engineering team has 2-3 engineers available for this sprint. Vendor negotiations run in parallel with engineering.

---

### Week 1 — Stop the Bleeding + Vendor Outreach (Days 1-7)

**Theme:** Zero new risk, start contract track, quick wins.

#### Day 1-2: Immediate Risk Reduction (No BAA Needed)

**PostHog (immediate code change):**
- [ ] In `src/main.tsx`: Add `disable_session_recording: true` to `posthog.init()`.
- [ ] In `src/App.tsx`: Remove provider `email` and `name` from `posthog.identify()` call. Only pass `provider.id`.
- [ ] Remove or sanitize `dashboard_viewed` event — keep only `provider_id`, remove any fields that could identify the patient context.

**Slack (immediate code change):**
- [ ] In `src/services/api.ts` (`notifyLoginToSlack`): Remove `email` and `name` from the Slack payload. Send only `providerId`, `timestamp`, `source`, `stage`.

**Debug routes (immediate code change):**
- [ ] In `src/App.tsx`: Gate all `/debug/*` routes behind `import.meta.env.DEV` or a separate build flag so they are unreachable in production builds.

**Brevo (immediate operational change):**
- [ ] Audit every Brevo email flow. Identify which contain PHI (names + clinical context).
- [ ] Immediately pause PHI-containing Brevo campaigns/automations. Non-PHI general campaigns can continue temporarily.

**Zapier (immediate operational change):**
- [ ] Identify every Zap that references the Airtable bases containing PHI.
- [ ] Pause or delete Zaps that pass patient names, phone numbers, or appointment context through Zapier. The SMS Notifications table → OpenPhone Zap is the most critical.

#### Day 2-3: Vendor Outreach (Contract Track)

- [ ] **Airtable:** Email enterprise@airtable.com. Subject: "HIPAA BAA inquiry — small healthcare team". Ask about Health Information Exhibit, minimum seat pricing, monthly billing.
- [ ] **Vercel:** In Vercel dashboard, check Pro plan and enable HIPAA BAA add-on (or contact sales@vercel.com if not self-serve).
- [ ] **GCP:** Execute GCP HIPAA BAA self-serve in GCP console. Confirm GCS, Cloud TTS, Vertex AI are on covered services list.
- [ ] **PostHog:** Email privacy@posthog.com asking about BAA options and Boost tier pricing. Evaluate vs. removing PostHog PHI exposure entirely.
- [ ] **OpenPhone/Quo:** Contact account team to upgrade plan and request BAA.

#### Day 3-5: Auth Architecture Decision and Setup

- [ ] Finalize identity provider choice: **Firebase Auth** (under GCP BAA if covered) or **Google Cloud Identity Platform** (same underlying service, more enterprise controls).
- [ ] Create Firebase project in same GCP org as other services.
- [ ] Enable Firebase Auth with Email/Password + Google Sign-In.
- [ ] Enable Firebase Multi-Factor Authentication (TOTP or SMS-based).
- [ ] Draft Firebase custom claims schema: `{ providerId: string, role: "admin" | "staff" | "super-admin" }`.
- [ ] Create admin SDK utility to mint tokens and assign custom claims.

#### Day 5-7: Backend Auth Middleware Skeleton

- [ ] In `backend/src/index.ts`: Add `verifyFirebaseToken` middleware function using Firebase Admin SDK.
- [ ] Add middleware to the 10 highest-risk routes (see Section 6) — at minimum as a logging layer that won't break existing flows, with hard enforcement to follow in Week 2.
- [ ] Add `express-rate-limit` to all dashboard and public endpoints.
- [ ] Add audit log middleware stub (see Section 9) — wire into high-risk routes.

**Week 1 Deliverables:**
- PostHog session recording off in production
- Slack stripped of PHI
- Debug routes production-gated
- Brevo PHI sends paused
- Zapier PHI automations paused
- All vendor BAA requests submitted
- Firebase Auth project created
- Auth middleware skeleton deployed

---

### Week 2 — Authentication Live + Backend Hardening Begins (Days 8-14)

**Theme:** Individual logins replace shared codes. Routes start enforcing auth.

#### Day 8-10: Firebase Auth Integration — Frontend

- [ ] In `src/components/auth/`: Create `FirebaseLoginScreen.tsx` replacing `ProviderLoginScreen.tsx`.
  - Email/password or Google Sign-In via Firebase SDK.
  - MFA enrollment flow for new users.
  - On successful login: fetch Firebase ID token → send to backend → backend returns provider context.
- [ ] In `src/App.tsx`: Replace `loadProviderInfo()` / `saveProviderInfo()` pattern with Firebase `onAuthStateChanged` listener.
- [ ] In `src/utils/providerStorage.ts`: Remove provider `email`, `name`, and sensitive fields from `localStorage`. Store only `providerId` and non-PHI display fields.
- [ ] Implement idle timeout: After 30 minutes of no interaction, call `firebase.auth().signOut()` and redirect to login.
- [ ] Implement token refresh: Use Firebase's automatic token refresh; ensure frontend detects 401 responses and re-authenticates.

#### Day 8-10: Firebase Auth Integration — Backend

- [ ] Install `firebase-admin` SDK in backend.
- [ ] Create `middleware/auth.ts`:
  ```typescript
  async function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      req.user = { uid: decoded.uid, providerId: decoded.providerId, role: decoded.role };
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  }
  ```
- [ ] Create `middleware/requireProviderScope.ts` — verifies that the `providerId` in the request matches the user's claim.

#### Day 10-12: User Provisioning System

- [ ] Create `POST /api/admin/provision-user` (admin-only): Creates Firebase user, sets custom claims with `providerId` and `role`, sends invitation email.
- [ ] Create `POST /api/admin/deprovision-user` (admin-only): Disables Firebase user, revokes tokens, logs deprovisioning action.
- [ ] Create provider-to-user mapping in Airtable Providers table: Add "Firebase UIDs" or "User Emails" field to track who has access.
- [ ] Create simple admin UI page (internal only) for managing user accounts.
- [ ] Run migration: Create Firebase accounts for all existing provider code users. Send invitation emails with temporary password and MFA enrollment instructions.

#### Day 11-14: Backend Route Hardening — Priority Routes

Apply `requireAuth` + `requireProviderScope` to routes in this order:

1. `PATCH /api/dashboard/update-record` — Add auth + validate `tableName` is in allowlist `["Patients", "Web Popup Leads", "Providers"]` + validate `fields` keys are in per-table allowlists.
2. `GET /api/dashboard/leads` — Add auth + enforce `providerId` filter in Airtable query.
3. `PATCH /api/dashboard/leads/:recordId` — Add auth + verify record belongs to provider.
4. `GET /api/dashboard/contact-history` — Add auth + provider scope.
5. `POST /api/dashboard/sms` — Add auth + provider scope.
6. `GET /api/dashboard/sms-notifications` — Add auth.
7. `PATCH /api/dashboard/provider/:providerId` — Add auth + verify `providerId` matches token claim.
8. `GET /api/dashboard/provider` — Add auth.
9. `GET /api/dashboard/records/:tableName` — Add auth + restrict to allowed tables + add provider filter.
10. `PATCH /api/dashboard/records/:tableName/:recordId` — Add auth + allowed tables + ownership check.

**Week 2 Deliverables:**
- Firebase Auth live; staff invited and migrated
- MFA enforced for all staff accounts
- Shared provider code login retired or running in parallel with deprecation notice
- Top 10 backend routes protected with auth middleware
- User provisioning/deprovisioning operational

---

### Week 3 — Route Hardening Complete + Email Replacement + Audit Logging (Days 15-21)

**Theme:** Close remaining backend gaps, replace Brevo, ship audit logs.

#### Day 15-17: Remaining Backend Hardening

- [ ] `GET /api/patient-records` — This is the patient app's record lookup. If it's used only by patients (not staff), validate the patient context via a signed token or JWT rather than a raw email param. At minimum add rate limiting and strip returned fields to minimum necessary.
- [ ] `GET /api/patient-data` — Same as above.
- [ ] `GET /api/photos` — Confirm this does not return PHI-linked identifiers without appropriate scoping.
- [ ] `POST /api/dashboard/blueprint` — Add auth (staff only); validate `patient.id` belongs to the authenticated provider's records before saving.
- [ ] `GET /api/dashboard/blueprint` — Public token route: add rate limiting (e.g. 10 requests/min per IP), enforce token entropy (reject short or predictable tokens), add blueprint expiry enforcement.
- [ ] `GET /api/dashboard/blueprint/front-photo` — Add token+patientId validation to ensure the token was issued for this patient; prevent enumeration of other patients' photos.
- [ ] `POST /api/post-visit-blueprint/booking-intent` — Rate limit; validate token against stored blueprint before writing booking record.
- [ ] `GET /api/dashboard/cors-test` — Remove entirely from production or gate behind internal-only IP allowlist.
- [ ] `POST /api/logs` — Validate `actionType` against an allowlist; do not log raw `patientEmail` — log hashed or use patient record ID instead.
- [ ] `POST /api/skin-quiz/submit` — Rate limit; validate required fields; do not log submitted PHI.
- [ ] `GET /api/skin-quiz/results` — Add appropriate token validation.
- [ ] `POST /api/doctor-advice-requests` — Add auth.
- [ ] `GET /api/dashboard/doctor-advice-requests` — Add auth + provider scope.
- [ ] `POST /api/dashboard/help-requests` — Rate limit; sanitize inputs.

**Move PHI out of query strings:**
- [ ] `GET /api/patient-records?email=...` → move to POST body or token-based lookup.
- [ ] `GET /api/patient-data?email=...` → same.
- [ ] Any other GET routes with PHI in URL params.

#### Day 15-17: Remove Zapier Automation, Internalize SMS Flow

- [ ] Delete Zap: Airtable SMS Notifications → OpenPhone.
- [ ] Update backend: When dashboard triggers a notification, call OpenPhone API directly from `/api/dashboard/sms` (already partially implemented) and write log directly to Airtable. Remove the indirect SMS Notifications table trigger pattern.
- [ ] If any Airtable automations (not Zapier) are in use, review them — under Enterprise BAA they can be used for PHI.

#### Day 17-19: Email Replacement for PHI Flows

- [ ] **Option A (preferred if Google Workspace already in use):** Execute Google Workspace BAA via Admin Console. Add Gmail API integration to backend for transactional sends from a service account or domain email. Confirm Gmail is on Google's HIPAA Included Functionality list.
- [ ] **Option B (new AWS path):** Create AWS account, execute AWS BAA, configure Amazon SES, integrate SES SDK into backend.
- [ ] **Option C (fastest with highest cost):** Sign up for Paubox (healthcare email). Get BAA. Integrate their API.
- [ ] All PHI-containing emails (appointment confirmations, treatment summaries, blueprint share notifications) route through the new BAA-covered path.
- [ ] Non-PHI emails (general newsletters, no patient identifiers) may optionally remain on Brevo.

#### Day 18-21: Audit Logging — Full Implementation

See Section 9 for schema. Tasks:

- [ ] Implement `auditLog(req, action, resource, outcome)` helper in backend.
- [ ] Wire into all auth-protected routes.
- [ ] Ship logs to external immutable store (Google Cloud Logging under GCP BAA is simplest if already using GCP).
- [ ] Set log retention to 6 years.
- [ ] Create simple audit log viewer for Security Officer (can be a GCP Logs Explorer saved query initially).
- [ ] Set alert: >10 failed auth attempts from same IP in 1 hour.
- [ ] Set alert: Any access to more than 50 patient records in a single session.

**Week 3 Deliverables:**
- All backend routes hardened and scoped
- PHI removed from query strings
- Zapier PHI automations replaced with in-backend calls
- Email BAA path live; Brevo PHI flows migrated
- Audit logging deployed and shipping to immutable store

---

### Week 4 — Validation, Operations, Training, Contracts Closed (Days 22-30)

**Theme:** Close the loop — confirm contracts, validate controls, train, go live.

#### Day 22-24: Contract Closure and Vendor Configuration

- [ ] **Airtable:** BAA executed. Designate production base as HIPAA workspace. Enable SSO (SAML), audit logs, and DLP controls required under the BAA.
- [ ] **Vercel:** BAA add-on confirmed active on production team.
- [ ] **GCP:** BAA confirmed. Verify GCS bucket, Cloud TTS, Vertex AI are all on covered services list. Enable Cloud Audit Logs for all GCP services in scope.
- [ ] **Firebase/GCP:** Confirm Firebase Auth is under GCP BAA. Enable Firebase Auth audit logging.
- [ ] **OpenPhone/Quo:** BAA executed. Document that SMS is not under BAA and add patient consent capture to SMS flows.
- [ ] **PostHog:** Either BAA executed (Boost plan) with session recording disabled and PHI-free events, OR PostHog fully removed from PHI-handling pages. Decision must be made by Day 15.
- [ ] **Slack:** PHI-free configuration confirmed. Verify `notifyLoginToSlack()` no longer sends any PHI fields.
- [ ] **Brevo:** Either completely off for PHI or removed from PHI-containing flows.
- [ ] **Zapier:** All PHI Zaps deleted or archived.
- [ ] Build and sign final vendor matrix document as internal compliance record.

#### Day 24-26: Policies and Procedures

Work with legal counsel to finalize:

- [ ] **Information Security Policy** — covers classification, handling, and disposal of PHI.
- [ ] **Acceptable Use Policy** — devices, access, remote work rules.
- [ ] **Breach Notification Policy** — who, what, when, how for incident response.
- [ ] **Sanction Policy** — consequences for violations.
- [ ] **Workforce Confidentiality Agreement** — all staff sign.
- [ ] **Risk Analysis document** — formal HIPAA risk analysis finalized with legal.
- [ ] **BAA register** — list of all signed BAAs with vendor, date, term, contacts.

#### Day 26-27: Workforce Training

- [ ] Create or adopt a HIPAA workforce training module (HHS provides free materials; many compliance vendors offer inexpensive courses).
- [ ] All staff who access PHI complete training and sign training log.
- [ ] Training covers: What is PHI, handling rules, how to use the dashboard safely, incident reporting steps.

#### Day 27-29: End-to-End Validation

- [ ] **Auth flow test:** Attempt access with expired token, wrong provider scope, no token — confirm all 401.
- [ ] **Route scope test:** Attempt to read/write another provider's records — confirm all blocked.
- [ ] **Public token test:** Attempt blueprint endpoint with invalid/expired token — confirm 404.
- [ ] **Rate limit test:** Confirm rate limiting fires on public endpoints.
- [ ] **Audit log test:** Perform a sequence of actions and confirm all appear in audit log with correct fields.
- [ ] **PostHog test:** Confirm session replay events are not being sent in production.
- [ ] **localStorage test:** Confirm no PHI fields are in browser localStorage in production.
- [ ] **Dependency scan:** Run `npm audit` on both frontend and backend; resolve critical/high severity issues.

#### Day 29-30: Go-Live and Documentation

- [ ] Security Officer signs compliance readiness memo.
- [ ] Legal counsel reviews and signs off.
- [ ] Tag repository with compliance version: `v-hipaa-phase1-YYYY-MM-DD`.
- [ ] Document open items / future phases (patient access rights workflow, SOC 2, advanced threat detection).
- [ ] Set calendar for annual risk analysis review.
- [ ] Post-implementation retrospective with team.

---

## 6. Backend Route Security Matrix

| Route | Method | Current Auth | Target Auth | PHI? | Priority |
|-------|--------|-------------|-------------|------|----------|
| `/api/dashboard/update-record` | PATCH | None | `requireAuth` + table/field allowlist + provider scope | YES | CRITICAL |
| `/api/dashboard/records/:tableName` | GET | None | `requireAuth` + allowed tables + provider filter | YES | CRITICAL |
| `/api/dashboard/records/:tableName/:recordId` | PATCH/POST | None | `requireAuth` + allowed tables + ownership check | YES | CRITICAL |
| `/api/dashboard/leads` | GET | None | `requireAuth` + provider scope filter | YES | CRITICAL |
| `/api/dashboard/leads/:recordId` | PATCH | None | `requireAuth` + ownership check | YES | CRITICAL |
| `/api/patient-records` | GET | None (email param) | Token-based lookup + rate limit | YES | CRITICAL |
| `/api/patient-data` | GET | None (email param) | Token-based lookup + rate limit | YES | CRITICAL |
| `/api/dashboard/provider` | GET | None | `requireAuth` | YES (provider) | HIGH |
| `/api/dashboard/provider/:providerId` | PATCH | None (ALLOWED_FIELDS exists) | `requireAuth` + same-provider check | YES | HIGH |
| `/api/dashboard/sms` | POST | None | `requireAuth` + provider scope | YES | HIGH |
| `/api/dashboard/sms-notifications` | GET/POST | None | `requireAuth` + provider scope | YES | HIGH |
| `/api/dashboard/contact-history` | GET/POST | None | `requireAuth` + provider scope | YES | HIGH |
| `/api/dashboard/blueprint` | POST | None | `requireAuth` (staff only) | YES | HIGH |
| `/api/dashboard/blueprint` | GET | Token-only | Token validation + rate limit + patient binding | YES | HIGH |
| `/api/dashboard/blueprint/front-photo` | GET | Token+patientId | Validate token↔patient binding + rate limit | YES | HIGH |
| `/api/post-visit-blueprint/booking-intent` | POST | None | Token validation + rate limit | YES | MEDIUM |
| `/api/dashboard/doctor-advice-requests` | GET/POST | None | `requireAuth` + provider scope | YES | MEDIUM |
| `/api/skin-quiz/submit` | POST | None | Rate limit + input validation | YES | MEDIUM |
| `/api/skin-quiz/results` | GET | Token | Token validation | YES | MEDIUM |
| `/api/dashboard/login-notification` | POST | None | `requireAuth` or remove | MAYBE | MEDIUM |
| `/api/dashboard/app-logins` | POST | None | `requireAuth` | LOW | MEDIUM |
| `/api/logs` | POST | None | Rate limit + hash patient email | YES | MEDIUM |
| `/api/interest-items` | GET/POST/DELETE | None | Token/session validation | MAYBE | MEDIUM |
| `/api/dashboard/help-requests` | POST | None | Rate limit + `requireAuth` | LOW | LOW |
| `/api/dashboard/cors-test` | GET | None | REMOVE in production | NO | LOW |
| `/api/dashboard/offers` | GET | None | `requireAuth` + provider scope | LOW | LOW |
| `/api/treatments` | GET | None | Rate limit | LOW | LOW |
| `/health` | GET | None | Keep public | NO | N/A |

---

## 7. Frontend Changes Required

### 7.1 Authentication (`src/components/auth/`)

- **Remove:** `ProviderLoginScreen.tsx` (shared code login)
- **Add:** `FirebaseLoginScreen.tsx` with Firebase SDK, MFA flow, Google SSO button
- **Add:** MFA enrollment page for first-time setup
- **Update:** `App.tsx` — replace `loadProviderInfo()` with `onAuthStateChanged`; add idle timeout logic (30 min); add token refresh handler

### 7.2 PostHog (`src/main.tsx`, `src/App.tsx`)

```typescript
// main.tsx — add immediately
posthog.init(posthogKey, {
  disable_session_recording: true,   // ADD THIS
  autocapture: false,                // ADD THIS — prevents automatic PHI capture
  capture_pageleave: false,          // ADD THIS
  ...
});

// App.tsx — sanitize identify()
posthog.identify(provider.id);      // ONLY pass ID, remove email/name
```

### 7.3 localStorage Reduction (`src/utils/providerStorage.ts`)

- Remove `email` and `name` from `localStorage` provider object. Store only `id`, `code`, `displayName` (non-PHI).
- Blueprint cache (`src/utils/postVisitBlueprint.ts`): Evaluate whether `localStorage` caching is necessary. If required for UX, ensure blueprint data does not remain after session ends (use `sessionStorage` instead of `localStorage`, or set a short TTL on cache entries).

### 7.4 Debug Routes (`src/App.tsx`)

```typescript
// Gate ALL debug routes
if (import.meta.env.DEV && debugRoute) {
  // render debug components
}
// In production: debugRoute check never passes
```

### 7.5 Session Security

- Add `X-Frame-Options: DENY` and `Content-Security-Policy` headers via Vercel config (`vercel.json`).
- Add `Referrer-Policy: no-referrer` to prevent PHI leakage via referrer header on outbound links.
- Add session timeout banner: show "You will be logged out in 5 minutes" warning before idle logout.

### 7.6 PHI in URLs

- Remove patient email from any URL query params (`/api/patient-records?email=...`).
- Remove any patient identifiers from shareable URL patterns (blueprint tokens are fine; raw patient IDs or emails are not).

---

## 8. Authentication Architecture — Firebase Approach

### Why Firebase Auth

- Under GCP BAA (confirm covered services list)
- Supports MFA (TOTP and SMS)
- Custom claims for RBAC
- Free tier sufficient for small team sizes
- Admin SDK works well in Node.js backend
- Familiar Google ecosystem consistent with GCS and Vertex AI already in use

### User Flow

```
Staff member opens dashboard
  → Firebase Google SSO or email/password
  → MFA challenge (TOTP or SMS)
  → Firebase returns ID token (JWT, 1h expiry)
  → Frontend stores token in memory (not localStorage)
  → Frontend attaches token to all API calls: Authorization: Bearer <token>
  → Backend verifyIdToken() → extracts uid, providerId, role
  → Route handler uses providerId to scope all Airtable queries
  → Token auto-refreshes silently via Firebase SDK
  → 30 min idle → frontend calls auth.signOut() → clears memory
```

### Custom Claims Schema

```typescript
interface FirebaseClaims {
  providerId: string;          // Airtable Provider record ID
  providerCode: string;        // e.g. "ponce" — for display only
  role: "admin" | "staff" | "super-admin";
}
```

### Role Definitions

| Role | Access |
|------|--------|
| `staff` | Read/write their provider's patient records, send SMS, view blueprints |
| `admin` | All staff permissions + manage users for their provider |
| `super-admin` | All providers, internal tooling, audit logs |

### Migration from Provider Codes

1. Create Firebase account for each current provider code user.
2. Set custom claims with their `providerId` and initial `role: "admin"`.
3. Send invite email with MFA enrollment instructions.
4. Run parallel login period: old code login redirects to "migrate your account" page.
5. After 2-week migration window, disable provider code login entirely.

---

## 9. Audit Logging Design

### Log Schema

Every protected route emits a structured log entry:

```typescript
interface AuditLogEntry {
  timestamp: string;        // ISO 8601
  userId: string;           // Firebase UID
  providerId: string;       // from token claim
  role: string;             // from token claim
  action: string;           // e.g. "READ_PATIENT_LIST", "UPDATE_TREATMENTS_DISCUSSED"
  resource: {
    table: string;           // e.g. "Patients"
    recordId?: string;       // Airtable record ID if applicable
  };
  outcome: "success" | "failure" | "forbidden";
  statusCode: number;
  ip: string;               // req.ip
  userAgent: string;        // req.headers["user-agent"]
  requestId: string;        // uuid per request
}
```

### Action Vocabulary

| Action | Trigger |
|--------|---------|
| `AUTH_LOGIN` | Successful Firebase token verification |
| `AUTH_FAILURE` | Invalid/expired token on protected route |
| `READ_PATIENT_LIST` | `GET /api/dashboard/leads` |
| `READ_PATIENT_DETAIL` | `GET /api/patient-data` |
| `UPDATE_PATIENT_RECORD` | `PATCH /api/dashboard/update-record` or `PATCH /api/dashboard/leads/:id` |
| `READ_BLUEPRINT` | `GET /api/dashboard/blueprint` |
| `CREATE_BLUEPRINT` | `POST /api/dashboard/blueprint` |
| `SEND_SMS` | `POST /api/dashboard/sms` |
| `ADMIN_PROVISION_USER` | `POST /api/admin/provision-user` |
| `ADMIN_DEPROVISION_USER` | `POST /api/admin/deprovision-user` |

### Log Storage

- **Primary:** Google Cloud Logging (under GCP BAA) — use GCP logging SDK from backend.
- **Retention:** Set log bucket retention policy to 6 years (HIPAA minimum).
- **Access:** Only Security Officer and super-admins can query audit logs.
- **Integrity:** GCP Cloud Logging is immutable by default (cannot be edited/deleted by application layer).

### Alerts

- 10+ auth failures from same IP in 1 hour → PagerDuty/email to Security Officer.
- Any `ADMIN_PROVISION_USER` or `ADMIN_DEPROVISION_USER` event → immediate notification to Security Officer.
- >50 patient records read in a single session → review alert.

---

## 10. Operational Readiness Checklist

### Policies (Legal Counsel to Draft)

- [ ] Information Security Policy
- [ ] Acceptable Use Policy (device, remote access, data handling)
- [ ] Breach Notification Policy (timelines, contacts, templates)
- [ ] Sanction Policy
- [ ] Contingency Plan (backup and DR procedures)
- [ ] Risk Analysis document
- [ ] Privacy Notice / NPP coordination with covered entity partners

### Workforce

- [ ] All PHI-touching staff complete HIPAA training (document date and name)
- [ ] All staff sign Confidentiality Agreement
- [ ] Security Officer and Privacy Officer formally designated
- [ ] Emergency access procedure documented and tested

### Incident Response Runbook (Summary)

```
Step 1 — Detect: Alert fires OR staff reports suspected breach
Step 2 — Contain: Security Officer disables affected accounts; rotates relevant keys
Step 3 — Assess: 4-factor breach risk assessment (PHI type, who accessed, was it acquired, mitigation extent)
Step 4 — Notify:
  - If <500 individuals: Log for annual HHS report; notify affected individuals within 60 days
  - If >=500 in a state: Notify individuals + HHS + prominent media within 60 days
  - If breach involves Business Associate: Notify covered entity partners without unreasonable delay
Step 5 — Remediate: Fix root cause; deploy patches; update controls
Step 6 — Document: Complete incident log; update risk analysis
```

### Key Contacts Template

| Role | Name | Contact |
|------|------|---------|
| Security Officer | ___ | ___ |
| Privacy Officer | ___ | ___ |
| Legal Counsel | ___ | ___ |
| Airtable Account Team | ___ | enterprise@airtable.com |
| Vercel Support | ___ | support@vercel.com |
| GCP Support | ___ | console.cloud.google.com/support |
| OpenPhone/Quo | ___ | support@quo.com |

---

## 11. Success Criteria and Go-Live Gates

The implementation is complete when ALL of the following are true:

### Contractual
- [ ] Airtable BAA/Health Information Exhibit signed and production workspace designated
- [ ] Vercel BAA active on production team
- [ ] GCP BAA executed and all in-scope services confirmed on covered list
- [ ] OpenPhone/Quo BAA executed (and SMS consent policy documented)
- [ ] PostHog BAA signed OR PostHog confirmed PHI-free (session recording off, no PHI in events)
- [ ] Brevo replaced for all PHI email flows with BAA-covered path
- [ ] Zapier PHI automations deleted
- [ ] Slack confirmed PHI-free

### Technical — Authentication
- [ ] All staff have individual Firebase accounts with MFA enrolled
- [ ] Provider code shared login retired
- [ ] Frontend stores no PHI in localStorage
- [ ] Session idle timeout (30 min) implemented and tested
- [ ] Token expiry (1h) handled gracefully with re-authentication

### Technical — Backend
- [ ] All routes in Section 6 marked CRITICAL have auth middleware
- [ ] All routes in Section 6 marked HIGH have auth middleware
- [ ] Provider scope enforced on all patient data reads/writes
- [ ] No PHI in URL query parameters on any route
- [ ] Rate limiting on all public token routes
- [ ] Generic update-record endpoint restricted to field/table allowlists
- [ ] Debug/CORS-test endpoints disabled in production

### Technical — Audit and Monitoring
- [ ] Audit log deployed and shipping to immutable store
- [ ] Audit log retention set to 6 years
- [ ] Auth failure alerting active
- [ ] Unusual volume alerting active

### Operational
- [ ] Risk analysis completed and signed
- [ ] All policies drafted and approved
- [ ] All staff trained (training log completed)
- [ ] Incident response runbook tested (tabletop exercise)
- [ ] Disaster recovery backup procedure tested (restore from Airtable snapshot or GCS export)
- [ ] BAA register complete with all vendors
- [ ] Annual review calendar event set

### Sign-Off

| Reviewer | Role | Date |
|----------|------|------|
| ___ | Security Officer | ___ |
| ___ | Legal Counsel | ___ |
| ___ | Engineering Lead | ___ |
| ___ | Program Owner | ___ |

---

*Last updated: April 2026. Revisit after any major system change or annually.*
