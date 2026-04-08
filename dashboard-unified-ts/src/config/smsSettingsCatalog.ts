export type SmsChannel = "sms" | "email";

export interface SmsTemplateEventConfig {
  id: string;
  eventName: string;
  trigger: string;
  enabled: boolean;
  channel: SmsChannel;
  template: string;
  /** Send counts derived from Airtable SMS log (as of Apr 8 2026). Undefined = not tracked in this data source. */
  recentVolume?: { d7: number; d14: number; d30: number };
}

export interface SmsProductConfig {
  id: string;
  productName: string;
  description: string;
  owner: string;
  events: SmsTemplateEventConfig[];
}

export const SMS_SETTINGS_PRODUCTS: SmsProductConfig[] = [
  {
    id: "treatment-finder",
    productName: "Website quiz leads",
    description:
      "Text messages for people who take the treatment quiz on your website and what happens next.",
    owner: "Growth / Leads",
    events: [
      {
        id: "finder-welcome",
        eventName: "Welcome + next step",
        trigger: "Someone submits the treatment finder form on your website.",
        enabled: true,
        channel: "sms",
        template:
          "Hi {{first_name}}, Welcome to The Treatment! Thank you for using our treatment tracker — we hope you loved your results! When you're ready, our team would love to sit down with you, go over your results, and build a treatment plan tailored just for you. Contact us by phone at (844) 344-7546 or book your visit here: {{booking_link}}",
        recentVolume: { d7: 246, d14: 275, d30: 275 },
      },
      {
        id: "finder-followup",
        eventName: "Follow-up reminder",
        trigger:
          "Lead submitted the Treatment Finder but hasn't booked an appointment yet.",
        enabled: true,
        channel: "sms",
        template:
          "Hi {{first_name}}, we wanted to follow up and see if you're ready to book your visit. Our team can help with facials, Botox, fillers, laser treatments, and more. Book using the link below or call us at (844)344-7546. {{booking_link}}",
        recentVolume: { d7: 0, d14: 0, d30: 0 },
      },
    ],
  },
  {
    id: "skincare-quiz",
    productName: "Skincare Quiz",
    description:
      "Skincare product recommendation flow and quiz follow-through messaging.",
    owner: "Growth / Leads",
    events: [
      {
        id: "skincare-quiz-invite",
        eventName: "Quiz invite",
        trigger: "Staff sends skincare quiz link to a lead or patient.",
        enabled: false,
        channel: "sms",
        template:
          "Let's find the perfect products for your skin! \nTake our quiz and get expert recommendations tailored just for you:\n{{link}}",
        recentVolume: { d7: 0, d14: 0, d30: 115 },
      },
      {
        id: "skincare-quiz-results",
        eventName: "Quiz results link",
        trigger:
          "Staff sends skincare quiz message for a record that already has saved quiz results.",
        enabled: false,
        channel: "sms",
        template:
          "View your Skin Type Quiz results and personalized product recommendations: {{skin_quiz_link}}",
        recentVolume: { d7: 0, d14: 1, d30: 17 },
      },
    ],
  },
  {
    id: "skin-analysis",
    productName: "At-Home Facial Analysis",
    description:
      "At-home AI facial scan and analysis lifecycle messaging (invite, processing, ready, and reminders).",
    owner: "Clinical Ops",
    events: [
      {
        id: "analysis-scan-invite",
        eventName: "AI scan invite",
        trigger:
          "Lead or patient is sent the at-home AI facial scan link.",
        enabled: false,
        channel: "sms",
        template:
          "The Treatment Skin Boutique: We are now utilizing a new patient tool to help track treatment progress and develop customized plans. Please complete the 5-min at-home AI facial scan prior to your next appointment: {{scan_link}}",
        recentVolume: { d7: 0, d14: 0, d30: 506 },
      },
      {
        id: "analysis-processing",
        eventName: "Scan received / processing",
        trigger: "Patient submits scan and analysis generation begins.",
        enabled: true,
        channel: "sms",
        template:
          "The Treatment Skin Boutique: Your facial scan has been completed and is being analyzed now. Due to strong demand, your results might take up to a day to deliver. We'll send you another notification when it's ready for you to review.",
        recentVolume: { d7: 2, d14: 63, d30: 220 },
      },
      {
        id: "analysis-ready",
        eventName: "Analysis ready",
        trigger: "Analysis status changes to Ready for Review",
        enabled: true,
        channel: "sms",
        template:
          "The Treatment Skin Boutique: Your AI facial analysis is ready to be reviewed. Check your inbox for an email from ponce.ai or access directly at: {{analysis_link}}\n\nReply STOP to opt-out",
        recentVolume: { d7: 142, d14: 288, d30: 687 },
      },
      {
        id: "analysis-review-reminder",
        eventName: "Review reminder",
        trigger: "Analysis not reviewed within reminder window",
        enabled: false,
        channel: "sms",
        template:
          "Reminder: Your facial analysis is still waiting! View it here: {{analysis_link}}. Reply STOP to opt out.",
        recentVolume: { d7: 0, d14: 86, d30: 225 },
      },
      {
        id: "analysis-final-reminder",
        eventName: "Final reminder",
        trigger: "Analysis still not opened by final reminder window.",
        enabled: false,
        channel: "sms",
        template:
          "Final reminder: Your analysis is still available. Don't miss it! {{analysis_link}}. Reply STOP to opt out.",
        recentVolume: { d7: 0, d14: 87, d30: 210 },
      },
      {
        id: "analysis-share-manual",
        eventName: "Share analysis (manual send)",
        trigger:
          "Staff clicks Share Analysis with Patient and sends from the modal.",
        enabled: true,
        channel: "sms",
        template:
          "{{provider_name}}: Your facial analysis results are ready! Access your personalized analysis and self-review at patients.ponce.ai. Log in with your email address to view your results.",
        recentVolume: { d7: 0, d14: 0, d30: 8 },
      },
    ],
  },
  {
    id: "treatment-plan",
    productName: "Treatment Plan / Post-Visit Blueprint",
    description:
      "Personalized plan sharing after provider consultation and checkout.",
    owner: "Clinical Ops",
    events: [
      {
        id: "plan-delivered",
        eventName: "Post-Visit Blueprint sent",
        trigger: "Provider taps Send Post-Visit Blueprint (manual).",
        enabled: true,
        channel: "sms",
        template:
          "Hi {{first_name}}, your custom treatment blueprint from {{clinic_name}} is ready. Review your plan here: {{blueprint_link}}",
        recentVolume: { d7: 0, d14: 0, d30: 1 },
      },
      {
        id: "plan-share-manual",
        eventName: "Share treatment plan (manual send)",
        trigger:
          "Staff clicks Share Treatment Plan with Patient and sends from the modal.",
        enabled: true,
        channel: "sms",
        template:
          "{{provider_name}}: Your treatment plan is ready. Here's what we discussed:\n\n{{plan_sections_and_items}}",
        recentVolume: { d7: 0, d14: 0, d30: 31 },
      },
      {
        id: "plan-followup",
        eventName: "Plan follow-up",
        trigger: "No booking after plan delivery",
        enabled: true,
        channel: "sms",
        template:
          "Hi {{first_name}}, wanted to follow up on your treatment plan. Reply here if you'd like to adjust your plan or timeline.",
        recentVolume: { d7: 0, d14: 0, d30: 0 },
      },
    ],
  },
  {
    id: "manual-messaging",
    productName: "Manual SMS (Staff Initiated)",
    description:
      "Messages sent directly by staff from chat/popups using custom text.",
    owner: "Front Desk / Clinical Ops",
    events: [
      {
        id: "manual-generic-send",
        eventName: "Generic SMS send",
        trigger:
          "Staff opens Send SMS / SMS popup and sends a custom message.",
        enabled: true,
        channel: "sms",
        template:
          "Free-form custom text entered by staff at send time (no fixed template).",
      },
    ],
  },
  {
    id: "scheduling",
    productName: "Appointment Scheduling",
    description:
      "Operational messages tied to consult and treatment appointments.",
    owner: "Front Desk",
    events: [
      {
        id: "appt-confirmation",
        eventName: "Appointment confirmation",
        trigger: "Appointment is created",
        enabled: true,
        channel: "sms",
        template:
          "You're booked for {{appointment_date}} at {{location_name}}. Reply if you need to reschedule.",
      },
      {
        id: "appt-reminder",
        eventName: "Appointment reminder",
        trigger: "24 hours before appointment",
        enabled: true,
        channel: "sms",
        template:
          "Reminder: your appointment is tomorrow at {{appointment_time}} at {{location_name}}.",
      },
    ],
  },
];
