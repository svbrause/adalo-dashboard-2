Here is the internal Product Spec for the Ponce AI Post-Visit Blueprint.

I have structured this specifically for your engineering and internal strategy teams. It frames the feature not just as a cool patient experience, but as a bottom-of-funnel conversion engine that leverages your existing architecture (AI Assessment, Plan Composer/Treatment Recommender, Treatment Explorer) and provides the hard telemetry you need to prove ROI to your enterprise clients.

Product Spec: Ponce AI "Post-Visit Blueprint"
Document Status: Internal Draft
Target Audience: Engineering, Product, Sales Leadership

Executive Summary & Objective
The Post-Visit Blueprint is a secure, personalized digital micro-site automatically generated for patients at the end of an in-clinic consultation.
The Problem: MedSpa patients suffer from "medical amnesia" and sticker shock post-consultation. Clinics lose high-ticket conversions because patients leave with generic paper brochures and no clear, low-pressure way to review their AI facial assessment, treatment rationale, and financing options at home.

Our Solution: Extend the Ponce AI ecosystem to the bottom of the funnel. By allowing the provider to auto-generate a custom digital blueprint with one click via the Plan Composer/Treatment Recommender, we empower patients to review their AI scan, watch templated provider videos, explore matched before/after cases, and secure financing from their couch.

Strategic Alignment & Business Value

For the MedSpa (Our Client): Increases high-ticket conversion rates without adding administrative work for the provider. Acts as an asynchronous closer.
For Ponce AI (Us): \* Expands our footprint from Top-of-Funnel (website plugin) and Mid-Funnel (in-clinic assessment) to Bottom-of-Funnel (deal closing).

Dispute/Churn Protection: Generates irrefutable, log-based evidence of patient engagement (opens, video views, CTA clicks) to prove ROI to clinics, even if the clinic's internal follow-up process is weak.
Drives adoption of the Treatment Explorer by actively pushing structured case data to the patient.

Core User Journeys
A. The Provider Journey (Focus: Zero-Friction)
Providers will not use this if it takes more than 15 seconds. It must integrate seamlessly into the existing Plan Composer/Treatment Recommender workflow.

Provider completes the AI Facial Assessment in the clinic.
Provider uses the Plan Composer/Treatment Recommender to select recommended treatments (e.g., Botox, IPL).
Provider clicks "Send Post-Visit Blueprint."
System Automation: Ponce AI automatically compiles the AI scan data, stitches the relevant pre-recorded provider videos, pulls matched B&A cases from the Treatment Explorer, and sends a Magic Link via SMS/Email to the patient.

B. The Patient Journey (Focus: Glossy, High-Trust Conversion)

Patient receives SMS: "Hi Sarah, your custom treatment blueprint from [Clinic Name] is ready. Review your plan here: [Link]"
Patient opens a mobile-optimized, "Clinical Chic" portal.
Patient reviews their AI scan, watches a stitched video of their provider explaining the specific treatments, reviews the itemized quote, and checks financing options.
Patient clicks "Book My Plan" or "Apply for Financing."
x
Key Modules & Engineering Requirements
| Module | Description | Ponce AI Dependencies |
|---|---|---|
| 1. The AI Mirror | An interactive view of the patient's in-clinic AI Facial Assessment, highlighting the specific areas (hotspots) the proposed plan will address. | Integrates with existing AI capture and assessment engine. |
| 2. Modular Video Stitching | Auto-assembles a personalized video greeting using pre-recorded clips (Opener + Treatment 1 + Treatment 2 + Closer). | Requires video hosting and a simple logic engine to map treatments to specific video files. |
| 3. Matched Case Gallery | A dynamic "See Results Like Mine" gallery. Automatically queries the database to show B&As matching the patient's demographics and recommended treatments. | Relies heavily on the new structured case data schema (age, sex, treatment type) we are collecting from clinics. |
| 4. Interactive Quoting | An itemized list of recommended treatments with pricing. Patients can toggle items on/off to see total cost changes. | Requires pricing data from the provider's setup or EMR integration (e.g., Zenoti). |
| 5. Bottom-of-Funnel CTAs | Actionable buttons: "Check Financing" (Cherry/CareCredit link out), "Book Now" (scheduling link out), and "Text Provider". | Simple URL parameter fields mapped per clinic during onboarding. |
Telemetry & Analytics (The "ROI Prover")
To protect Ponce AI from client disputes ("Your app didn't generate any revenue"), we must aggressively log patient behavior inside the Blueprint. This data will be surfaced in the Clinic Dashboard and our internal admin view.
Required Event Tracking:

blueprint_delivered: SMS/Email successfully sent.
blueprint_opened: Patient clicked the magic link.
video_played_module_X: Patient initiated the provider video.
case_gallery_viewed: Patient swiped through the B&A photos.
financing_clicked: Patient clicked the third-party financing link.
booking_clicked: Patient clicked the CTA to schedule.

Sales/CS Narrative: "Doctor, even though you only saw 10 bookings this week, our logs show 45 patients opened their Blueprint at home, and 30 clicked the financing button. The demand is there; let's look at your pricing."
Phase 1 MVP Scope Constraints
To get this to market quickly and validate the concept with our Enterprise pilots, Phase 1 will exclude:

Direct, native EMR write-backs for the booking (we will just link out to their existing Zenoti/Booking URL).
Native checkout/payment processing (we will link to CareCredit/Cherry).
Custom AR "Magic Mirror" outcome generation (we will rely entirely on the Treatment Explorer B&A cases for visual proof).

---

## Technical appendix: Hero / AI Mirror photo URLs (Airtable)

Airtable **attachment download URLs expire** (typically within a few hours; at least ~2h per Airtable). The blueprint link embeds patient data including that URL, so old links can show a broken hero image unless we mitigate.

**Implemented in the dashboard app:**

1. **Download at send time (Airtable’s recommended pattern)** — When the provider generates a blueprint, we `fetch` the image while the URL is still valid and embed a **data URL** (`frontPhotoDataUrl`) in the payload when the file is under ~150KB and CORS allows the fetch. The patient link then works without calling Airtable again.

2. **Optional backend refresh** — `GET /api/dashboard/blueprint/front-photo` on `ponce-patient-backend` can return a **fresh** attachment URL for `patientId` + `token`. The patient page calls this when there is no embedded data URL; until the route exists, the call no-ops and we fall back to the stored Airtable URL.

3. **Future: GCS (or similar)** — For very large images or stricter policies, the backend can copy the file to object storage when sending the blueprint and store a **permanent** URL in the payload (or return it from the refresh endpoint). Requires server-side implementation; `frontPhotoAttachmentId` is stored for that use case.

### Analysis highlights on the patient page

When the provider sends a blueprint, the payload can include **`analysisSummary`**: goals, concerns, aesthetic goals, interested issues, regions, skin complaints, and processed areas of interest (copied from the **Client** record at send time). The Post-Visit Blueprint page renders an **“Your analysis highlights”** card before the treatment TOC, and lists **plan-linked interests and findings** derived from `discussedItems` so older links without `analysisSummary` still show the connection between analysis and recommendations.
