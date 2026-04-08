/**
 * Email notification catalog — derived from the Email Notifications Airtable table.
 *
 * Each entry describes one type of automated email the system sends. The catalog
 * is informational: it helps providers see what their patients and team receive
 * and request changes via the support form.
 *
 * Template previews extracted from "Email Notifications-Grid view.csv" (8 338 rows, Apr 2026).
 * Dynamic values are shown as {placeholders}.
 */

export type EmailAudience = "patient" | "team" | "both";

export type EmailNotificationEntry = {
  id: string;
  /** Human-readable name shown in the settings table. */
  name: string;
  /** The email subject line template (curly-brace placeholders for dynamic values). */
  subjectTemplate: string;
  /** What event triggers this email. */
  trigger: string;
  /** Who receives the email. */
  audience: EmailAudience;
  /** Brief description of the email's purpose. */
  description: string;
  /** Plain-text preview of the email body (placeholders in {curly braces}). */
  templatePreview: string;
  /** Example or note — shows in the "Note" column when present. */
  note?: string;
  /**
   * Real @getthetreatment.com addresses observed in Email Notifications logs for this template
   * (or an honest note when none matched). Helps practices see who actually received these sends.
   */
  examplesAtGetTheTreatment?: string;
};

export type EmailNotificationCategory = {
  id: string;
  label: string;
  description: string;
  entries: EmailNotificationEntry[];
};

/** All email notification categories, ordered as they appear in the settings panel. */
export const EMAIL_NOTIFICATION_CATALOG: EmailNotificationCategory[] = [
  {
    id: "new-leads",
    label: "New leads & signups",
    description:
      "Sent when a prospective patient enters the system — either by completing the treatment finder or creating an account.",
    entries: [
      {
        id: "new-lead-treatment-finder",
        name: "New Treatment Finder Lead",
        subjectTemplate: "New Lead Treatment Finder",
        trigger: "A visitor completes the online Treatment Finder quiz",
        audience: "team",
        description:
          "Notifies the provider team that a new lead has come in from the Treatment Finder. Includes the patient's name, contact details, and treatment interests.",
        templatePreview:
          `New Lead!\n\nWe're pleased to inform you that {Patient Name} has requested a consultation.\n\nName: {Patient Name}\nPhone: {Phone Number}\n\nFor full contact details and interests, please log into your provider dashboard at analysis.ponce.ai using your provider code. Please reach out to schedule a consult at your earliest convenience.\n\nBest regards,\nThe Ponce AI Team`,
        examplesAtGetTheTreatment:
          "Team inboxes that received this alert in logs: hello@getthetreatment.com, isabel@getthetreatment.com (hundreds of sends in the export).",
      },
      {
        id: "new-lead-signup",
        name: "New Lead Signup",
        subjectTemplate: "Discover Your Facial Aesthetics with Our New AI Analysis App!",
        trigger: "A new patient account is created (e.g. via the quiz or web popup)",
        audience: "team",
        description:
          "Alert that a new prospective patient has signed up and is beginning the facial analysis journey.",
        templatePreview:
          `Your facial analysis is ready!\n\nDear {Patient Name},\n\nOur practice is now offering state-of-the-art AI-powered facial analysis — an innovative technology that provides a detailed, personalized look at your facial features. This tool helps determine opportunities to enhance your natural beauty with aesthetic treatments, essentially offering a mini consultation.\n\nAs one of our valued patients, I'm inviting you to be among the first to experience this breakthrough technology completely free. You can try our new experience by simply taking a few photos at home, without needing to visit the office or meet with our providers.\n\nWe're excited for you to explore this tool and gain a better understanding of how to achieve your ideal look.`,
        examplesAtGetTheTreatment:
          "No @getthetreatment.com recipient in the export for this subject (invites go to each patient's own email). Team copies still follow your Booking Email when the system CCs the practice.",
      },
    ],
  },
  {
    id: "analysis",
    label: "Facial analysis",
    description:
      "Emails around the AI facial analysis — from scan initiation through report delivery and follow-up.",
    entries: [
      {
        id: "analysis-initiated",
        name: "Analysis Initiated",
        subjectTemplate: "Your Personalized Facial Analysis Is On Its Way",
        trigger: "Patient successfully uploads their scan photos",
        audience: "patient",
        description:
          "Confirms that the scan was received and the AI report is being generated. Sets expectations on timing.",
        templatePreview:
          `Congrats, scan completed!\n\nHi {Patient Name},\n\nThank you for choosing {Practice Name} for your facial analysis. We're excited to let you know that your facial scan has been successfully completed. Our team is now processing your data to create a detailed analysis report and tailored treatment recommendations just for you.\n\nThis process typically takes 1–2 business days. Once your report is ready, we'll send you another email with all the information.\n\nWhile you're waiting for your report, feel free to check out our sample facial analysis report.\n\nWe appreciate your patience and look forward to sharing your personalized results soon!`,
        examplesAtGetTheTreatment:
          "Patient To: examples in logs include alessandra@, erin@, haley@, nathalie@, nicole@, nina@getthetreatment.com (staff tests or shared inboxes).",
      },
      {
        id: "analysis-ready",
        name: "Analysis Report Ready",
        subjectTemplate: "Your Facial Analysis Report is Ready for Review",
        trigger: "AI analysis processing is complete",
        audience: "both",
        description:
          "Primary report-ready notification. Goes to the patient with a link to open their report. The team is CC'd based on the Booking Email configured below.",
        templatePreview:
          `Congrats, scan completed!\n\nHi {Patient Name},\n\nWe are pleased to inform you that your facial analysis report is now ready for review. We appreciate your patience, and we're excited to share the results with you.\n\nWhen you review your report, you have the option to add any treatments that interest you to your personalized interest list. Additionally, you can request your doctor's advice on the selected treatments directly from the report.\n\nTo view your report, please click on the following link:\n\n[ Open My Report ]\n\nIf you have any questions or need further guidance, your doctor is here to help you make informed decisions about your treatment options.`,
        note: "Highest-volume email — ~1,100 sends in the dataset.",
        examplesAtGetTheTreatment:
          "Patient To: annie@, alessandra@, danis@, erin@, haley@, kinsey@, laurenr@, lillyg@, nathalie@, nicole@getthetreatment.com and others in the export. Team CC uses Booking Email when configured.",
      },
      {
        id: "analysis-awaiting-review",
        name: "Report Awaiting Review (Follow-up)",
        subjectTemplate: "Your Facial Analysis Report is Awaiting Your Review",
        trigger: "Patient has not opened their report after several days",
        audience: "patient",
        description:
          "Re-engagement nudge sent when a completed report has not been viewed. Prompts the patient to open their analysis.",
        templatePreview:
          `Your facial analysis is ready!\n\nHi {Patient Name},\n\nYour facial analysis report from {Practice Name} is ready but hasn't been reviewed yet! We created this report when you uploaded your photo on {Upload Date}.\n\nTo view your report, please access the app using the email you provided earlier:\n\n[ Open My Report ]`,
        examplesAtGetTheTreatment:
          "No @getthetreatment.com rows matched this subject in the export sample.",
      },
      {
        id: "analysis-upload-reminder",
        name: "Photo Upload Reminder",
        subjectTemplate: "Upload your photos to complete your facial analysis",
        trigger: "Patient started the process but has not yet uploaded their scan photos",
        audience: "patient",
        description:
          "Reminder email to patients who began the intake but did not complete the photo upload step.",
        templatePreview:
          `Congrats, scan in progress!\n\nHi {Patient Name},\n\nThank you for choosing {Practice Name} for your facial analysis. We're excited that you have completed the first step in the process to receive your personalized facial analysis report.\n\nOnly one step remains until we can process your analysis: uploading your photos.\n\nClick on the link below to access the photo upload form. Once your scan is complete and once your report is ready, we'll send you updated emails with all the information.\n\n[ Complete Scan ]\n\nWe appreciate your patience and look forward to sharing your personalized results soon!`,
        examplesAtGetTheTreatment:
          "No @getthetreatment.com rows matched this subject in the export sample.",
      },
      {
        id: "analysis-submission-issue",
        name: "Submission Issue",
        subjectTemplate: "Action Needed: Issues with Your Facial Assessment Submission",
        trigger: "The system detects a problem with the patient's scan photos",
        audience: "patient",
        description:
          "Informs the patient that their submission had a quality or processing issue and asks them to re-submit.",
        templatePreview:
          `Hi {Patient Name},\n\nThank you for submitting your scan for our online facial assessment. Unfortunately, our system encountered an issue with your submission that prevented us from completing your analysis.\n\nTo ensure we provide you with the most accurate and personalized aesthetic recommendations, we kindly ask that you resubmit your scan.\n\nHow to resubmit: Click the link below to try again:\n[ Resubmit Scan ]\n\nTips for a successful submission:\n• Lighting: Ensure your face is well-lit with no harsh shadows.\n• Framing: Your entire face should be visible in the frame.\n• Angles: Provide the required photos from the correct angles as instructed.`,
        examplesAtGetTheTreatment:
          "No @getthetreatment.com rows matched this subject in the export sample.",
      },
    ],
  },
  {
    id: "patient-activity",
    label: "Patient activity alerts",
    description:
      "Sent to your team when a patient takes meaningful action — opening their report or showing high treatment interest.",
    entries: [
      {
        id: "patient-opened-report",
        name: "Patient Opened Their Report",
        subjectTemplate: "{Patient Name} Has Reviewed Their Facial Analysis Report",
        trigger: "Patient opens their facial analysis report for the first time",
        audience: "team",
        description:
          "Real-time alert that a patient is actively reviewing their AI report — a key moment to reach out.",
        templatePreview:
          `Good news!\n\n{Patient Name} has just reviewed their facial analysis report. You can login to your provider dashboard and see their interest list.\n\n[ Go to Provider Dashboard ]`,
        note: "Also appears as: \u201CA Patient Just Opened Their AI Facial Analysis Report\u201D",
        examplesAtGetTheTreatment:
          "Team To: michelle@, nicole@, rachael@getthetreatment.com appeared as recipients in logs for this subject pattern.",
      },
      {
        id: "patient-opened-report-v2",
        name: "Patient Opened Their Report (Extended)",
        subjectTemplate: "A Patient Just Opened Their AI Facial Analysis Report",
        trigger: "Patient opens their facial analysis report (extended version)",
        audience: "team",
        description:
          "Extended version of the patient-opened alert, sent to some providers with additional context.",
        templatePreview:
          `An Exciting Opportunity!\n\nDear {Provider Name},\n\nGood news! {Patient Name} has just opened their facial analysis report. We're excited about how this report can enhance your consultation and improve patient outcomes.\n\nBest regards,\nThe Ponce AI Team`,
        examplesAtGetTheTreatment:
          "Export sample: To was often notifs@ponce.ai for this subject. The Treatment may use the same team inboxes as the other patient-opened alert (e.g. michelle@, rachael@getthetreatment.com) when configured.",
      },
      {
        id: "high-value-interest",
        name: "High-Value Interest Alert",
        subjectTemplate: "{Patient Name} is interested in treatments worth more than ${amount}",
        trigger: "Patient adds treatments to their wishlist that exceed a dollar threshold",
        audience: "team",
        description:
          "Flags high-intent patients who have self-selected expensive treatment combinations — prioritize follow-up.",
        templatePreview:
          `New Lead!\n\nWe're pleased to inform you that {Patient Name} has requested a consultation. The following details are also included in your provider dashboard:\n\nPatient Information\nName: {Patient Name}\nPhone Number: {Phone}\nEmail: {Email}\n\nTreatment Interest Summary:\n{Suggestion}   {Treatments}   {Price Range}\n\nFor full details, please log into your provider dashboard.`,
        examplesAtGetTheTreatment:
          "Export sample: To was notifs@ponce.ai for high-treatment-interest subjects; your Booking Email may be CC'd in parallel.",
      },
    ],
  },
  {
    id: "consultation",
    label: "Consultation requests",
    description:
      "Emails triggered when a patient submits a consultation request.",
    entries: [
      {
        id: "consult-confirmation-patient",
        name: "Consultation Confirmation (to patient)",
        subjectTemplate: "Your Consultation Request Has Been Received",
        trigger: "Patient submits a consultation request",
        audience: "patient",
        description:
          "Confirms receipt of the request and provides clinic contact details. Sent to the patient immediately.",
        templatePreview:
          `Request Received!\n\nDear {Patient Name},\n\nThank you for requesting a consultation! We've forwarded your request to {Provider Name}, and the doctor will be in touch with you soon to schedule a convenient time for your appointment.\n\nIn the meantime, if you need to reach the clinic directly, here are their contact details:\n\n🏥 Clinic Name: {Clinic Name}\n📞 Phone Number: {Phone}\n✉️ Email: {Booking Email}\n\nWe're excited to help you take the next step towards achieving your aesthetic goals!\n\nBest regards,\nThe Ponce AI Team`,
        examplesAtGetTheTreatment:
          "Patient To: erin@, haley@, laurenr@, nathalie@, nina@getthetreatment.com in logs (often staff or test accounts receiving the patient copy).",
      },
      {
        id: "consult-alert-team",
        name: "Consultation Request Alert (to team)",
        subjectTemplate: "New Consultation Request from {Patient Name}",
        trigger: "Patient submits a consultation request",
        audience: "team",
        description:
          "Notifies the provider team that a patient has requested a consultation. Includes the patient's name, phone, and email.",
        templatePreview:
          `New Consultation Request\n\nWe're pleased to inform you that {Patient Name} has requested a consultation. Here are the details you'll need:\n\nPatient Name: {Patient Name}\nPhone Number: {Phone}\nEmail: {Email}\n\nPlease reach out at your earliest convenience to schedule their appointment.`,
        examplesAtGetTheTreatment:
          "Team To: michelle@, nicole@, rachael@getthetreatment.com in the export for New Consultation Request alerts.",
      },
    ],
  },
  {
    id: "referrals",
    label: "Referrals",
    description: "Emails sent when a patient is referred to a provider or specialist.",
    entries: [
      {
        id: "referral-to-provider",
        name: "Referral to Provider (to patient)",
        subjectTemplate: "Referral to {Provider Name} for Your Treatment",
        trigger: "A patient is referred to a specific provider or specialist",
        audience: "patient",
        description:
          "Notifies the patient that they have been referred and provides the receiving provider's details.",
        templatePreview:
          `Referral doctor information\n\nDear {Patient Name},\n\n{Referring Provider} has referred you to {Specialist Name} for the next steps in your treatment plan. {Specialist Name} specializes in the areas discussed during your facial aesthetic analysis.\n\nPlease reach out to schedule your appointment:\n\nReferred Findings & Treatments: {Treatment List}\n\nReferral Doctor's Contact Information:\nProvider: {Specialist Name}\nPhone: {Phone}\nEmail: {Email}`,
        examplesAtGetTheTreatment:
          "No @getthetreatment.com recipient rows in the export for referral-to-patient subjects.",
      },
      {
        id: "referral-alert-team",
        name: "New Patient Referral (to team)",
        subjectTemplate: "New Patient Referral: {Patient Name}",
        trigger: "A patient is referred to the practice",
        audience: "team",
        description:
          "Alerts the receiving team that an inbound patient referral has been made.",
        templatePreview:
          `New Patient referred from {Referring Provider}\n\nHi {Receiving Provider},\n\nCongratulations on a new patient referral from {Referring Provider}. During the facial analysis review consultation, {Patient Name} expressed significant interest in findings that fall under your area of expertise.\n\nBased on this discussion and the patient's treatment goals, {Referring Provider} recommended that the patient consult with you for further evaluation and treatment.\n\nTo move forward, please feel free to reach out to the patient directly.\n\nPatient Contact:\nName: {Patient Name}\nPhone: {Phone}\nEmail: {Email}`,
        examplesAtGetTheTreatment:
          "No @getthetreatment.com recipient rows in the export for new-patient-referral team alerts.",
      },
    ],
  },
];

/** Flat list of all entries across all categories. */
export const ALL_EMAIL_NOTIFICATION_ENTRIES: EmailNotificationEntry[] =
  EMAIL_NOTIFICATION_CATALOG.flatMap((cat) => cat.entries);

export const EMAIL_NOTIFICATION_TOTAL_COUNT = ALL_EMAIL_NOTIFICATION_ENTRIES.length;
export const EMAIL_NOTIFICATION_CATEGORY_COUNT = EMAIL_NOTIFICATION_CATALOG.length;
