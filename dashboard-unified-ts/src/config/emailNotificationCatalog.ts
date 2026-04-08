/**
 * Automated email routing configuration.
 *
 * Each entry describes one type of automated email the system sends,
 * who receives it, and why. Derived from the Email Notifications export
 * (8 337 rows, Sept 2024 – Apr 2026) with routing inferred from the most
 * recent sends (Mar–Apr 2026).
 */

export type EmailRecipient = {
  email: string;
  /** Human label shown in the dashboard (e.g. "Front desk", "Rachael"). */
  label: string;
};

export type AutomatedEmail = {
  id: string;
  /** User-friendly name. */
  name: string;
  /** What triggers this email. */
  trigger: string;
  /** Example subject line. */
  exampleSubject: string;
  /** Whether the patient receives a copy. */
  goesToPatient: boolean;
  /** Team inboxes that currently receive this email (recent data). */
  teamRecipients: EmailRecipient[];
  /** Approx sends per month based on recent volume. */
  recentVolumePerMonth: number | null;
  /** Whether this email type is currently active (seen in recent sends). */
  active: boolean;
  /** One-sentence summary of what the email contains. */
  description: string;
  /** Representative body copy shown in the settings preview. */
  body?: string;
  /** Category grouping. */
  category: EmailCategory;
};

export type EmailCategory =
  | "new-leads"
  | "facial-analysis"
  | "patient-activity"
  | "consultations"
  | "referrals";

export const EMAIL_CATEGORY_LABELS: Record<EmailCategory, string> = {
  "new-leads": "New leads",
  "facial-analysis": "Facial analysis",
  "patient-activity": "Patient activity",
  "consultations": "Consultations",
  "referrals": "Referrals",
};

export const AUTOMATED_EMAILS: AutomatedEmail[] = [
  // ── New leads ──────────────────────────────────────────────────────────────
  {
    id: "new-lead-treatment-finder",
    name: "New Treatment Finder lead",
    trigger: "Someone completes the Treatment Finder quiz",
    exampleSubject: "New Lead Treatment Finder",
    goesToPatient: false,
    teamRecipients: [
      { email: "hello@getthetreatment.com", label: "Front desk" },
    ],
    recentVolumePerMonth: 290,
    active: true,
    description:
      "Alerts the team that a new lead came in from the Treatment Finder quiz with the patient's name and contact info.",
    body:
      "You have a new lead from the Treatment Finder quiz.\n\n" +
      "Name: {{name}}\n" +
      "Email: {{email}}\n" +
      "Phone: {{phone}}\n" +
      "Top concerns: {{concerns}}\n\n" +
      "Log in to the dashboard to view the full lead details and reach out.",
    category: "new-leads",
  },

  // ── Facial analysis ────────────────────────────────────────────────────────
  {
    id: "analysis-initiated",
    name: "Analysis started",
    trigger: "Patient uploads their scan photos",
    exampleSubject: "Your Personalized Facial Analysis Is On Its Way",
    goesToPatient: true,
    teamRecipients: [
      { email: "michelle@getthetreatment.com", label: "Michelle" },
    ],
    recentVolumePerMonth: 14,
    active: true,
    description:
      "Confirms to the patient that photos were received and the AI report is being generated.",
    body:
      "Hi {{first_name}},\n\n" +
      "We received your photos and your personalized facial analysis is on its way! Our AI is reviewing your scan and building your custom report.\n\n" +
      "You'll get another email as soon as it's ready — usually within a few minutes.\n\n" +
      "— The Treatment Team",
    category: "facial-analysis",
  },
  {
    id: "analysis-report-ready",
    name: "Report ready",
    trigger: "AI analysis is complete",
    exampleSubject: "{Patient}'s Facial Analysis Report is Ready for Review",
    goesToPatient: true,
    teamRecipients: [
      { email: "michelle@getthetreatment.com", label: "Michelle" },
      { email: "rachael@getthetreatment.com", label: "Rachael" },
    ],
    recentVolumePerMonth: 430,
    active: true,
    description:
      "Notifies the patient (and the team) that their facial analysis report is ready to view.",
    body:
      "Hi {{first_name}},\n\n" +
      "Your personalized facial analysis report is ready! View your full results, skin scoring, and treatment recommendations using the link below.\n\n" +
      "{{report_link}}\n\n" +
      "Our team is here to answer any questions and help you build a plan tailored to your goals.\n\n" +
      "— The Treatment Team",
    category: "facial-analysis",
  },
  {
    id: "analysis-upload-reminder",
    name: "Photo upload reminder",
    trigger: "Patient started the process but hasn't uploaded photos yet",
    exampleSubject: "Upload your photos to complete your facial analysis",
    goesToPatient: true,
    teamRecipients: [],
    recentVolumePerMonth: null,
    active: false,
    description:
      "Reminder to patients who began intake but didn't finish the photo upload step.",
    category: "facial-analysis",
  },
  {
    id: "analysis-awaiting-review",
    name: "Report awaiting review",
    trigger: "Patient hasn't opened their report after several days",
    exampleSubject: "Your Facial Analysis Report is Awaiting Your Review",
    goesToPatient: true,
    teamRecipients: [],
    recentVolumePerMonth: null,
    active: false,
    description:
      "Follow-up nudge sent when a completed report hasn't been viewed.",
    category: "facial-analysis",
  },
  {
    id: "analysis-submission-issue",
    name: "Submission issue",
    trigger: "Problem detected with the patient's scan photos",
    exampleSubject: "Action Needed: Issues with Your Facial Assessment Submission",
    goesToPatient: true,
    teamRecipients: [],
    recentVolumePerMonth: 1,
    active: true,
    description:
      "Tells the patient their submission had a quality issue and asks them to re-upload.",
    body:
      "Hi {{first_name}},\n\n" +
      "We noticed an issue with the photos you submitted for your facial analysis — unfortunately they weren't clear enough for our AI to process accurately.\n\n" +
      "Please re-upload your photos using the link below so we can get your report ready:\n\n" +
      "{{upload_link}}\n\n" +
      "If you have any trouble, feel free to reply to this email and our team will help.\n\n" +
      "— The Treatment Team",
    category: "facial-analysis",
  },

  // ── Patient activity ───────────────────────────────────────────────────────
  {
    id: "patient-opened-report",
    name: "Patient opened their report",
    trigger: "Patient opens their facial analysis report",
    exampleSubject: "{Patient} Has Reviewed Their Facial Analysis Report",
    goesToPatient: false,
    teamRecipients: [
      { email: "michelle@getthetreatment.com", label: "Michelle" },
      { email: "rachael@getthetreatment.com", label: "Rachael" },
      { email: "nicole@getthetreatment.com", label: "Nicole" },
    ],
    recentVolumePerMonth: 43,
    active: true,
    description:
      "Real-time alert that a patient is reviewing their report — a good moment to reach out.",
    body:
      "{{patient_name}} just opened their facial analysis report.\n\n" +
      "This is a great time to reach out and start a conversation about their results and treatment options.\n\n" +
      "Patient email: {{patient_email}}\n" +
      "Patient phone: {{patient_phone}}\n\n" +
      "View their full profile in the dashboard.",
    category: "patient-activity",
  },
  {
    id: "high-value-interest",
    name: "High-value interest alert",
    trigger: "Patient selects treatments above a dollar threshold",
    exampleSubject: "{Patient} is interested in treatments worth more than $3,100",
    goesToPatient: false,
    teamRecipients: [],
    recentVolumePerMonth: null,
    active: false,
    description:
      "Flags high-intent patients who selected expensive treatment combinations.",
    category: "patient-activity",
  },

  // ── Consultations ──────────────────────────────────────────────────────────
  {
    id: "consult-confirmation-patient",
    name: "Consultation confirmation",
    trigger: "Patient submits a consultation request",
    exampleSubject: "Your Consultation Request Has Been Received",
    goesToPatient: true,
    teamRecipients: [],
    recentVolumePerMonth: 27,
    active: true,
    description:
      "Confirms receipt of the consultation request and provides clinic contact details.",
    body:
      "Hi {{first_name}},\n\n" +
      "We received your consultation request — thank you! Our team will be in touch shortly to confirm your appointment.\n\n" +
      "In the meantime, feel free to reach us at hello@getthetreatment.com or call (844) 344-7546.\n\n" +
      "We look forward to seeing you!\n\n" +
      "— The Treatment Team",
    category: "consultations",
  },
  {
    id: "consult-request-team",
    name: "Consultation request alert",
    trigger: "Patient submits a consultation request",
    exampleSubject: "New Consultation Request from {Patient}",
    goesToPatient: false,
    teamRecipients: [
      { email: "michelle@getthetreatment.com", label: "Michelle" },
      { email: "rachael@getthetreatment.com", label: "Rachael" },
    ],
    recentVolumePerMonth: 44,
    active: true,
    description:
      "Alerts the team with patient name, phone, and email so they can schedule a consult.",
    body:
      "New consultation request received.\n\n" +
      "Name: {{patient_name}}\n" +
      "Email: {{patient_email}}\n" +
      "Phone: {{patient_phone}}\n" +
      "Requested date/time: {{requested_time}}\n\n" +
      "Please follow up to confirm their appointment.",
    category: "consultations",
  },

  // ── Referrals ──────────────────────────────────────────────────────────────
  {
    id: "referral-to-patient",
    name: "Referral notice",
    trigger: "Patient is referred to a provider or specialist",
    exampleSubject: "Referral to Dr. {Name} for Your Treatment",
    goesToPatient: true,
    teamRecipients: [],
    recentVolumePerMonth: null,
    active: false,
    description:
      "Notifies the patient they've been referred and provides the specialist's contact info.",
    category: "referrals",
  },
  {
    id: "referral-team-alert",
    name: "Inbound referral alert",
    trigger: "A patient referral is made to the practice",
    exampleSubject: "New Patient Referral: {Patient}",
    goesToPatient: false,
    teamRecipients: [],
    recentVolumePerMonth: null,
    active: false,
    description:
      "Alerts the team that an inbound patient referral has arrived.",
    category: "referrals",
  },
];

/** All unique team recipients across active emails. */
export function getActiveTeamRecipients(): EmailRecipient[] {
  const seen = new Set<string>();
  const out: EmailRecipient[] = [];
  for (const email of AUTOMATED_EMAILS) {
    if (!email.active) continue;
    for (const r of email.teamRecipients) {
      if (!seen.has(r.email)) {
        seen.add(r.email);
        out.push(r);
      }
    }
  }
  return out;
}

export const AUTOMATED_EMAIL_COUNT = AUTOMATED_EMAILS.length;
export const ACTIVE_EMAIL_COUNT = AUTOMATED_EMAILS.filter((e) => e.active).length;
