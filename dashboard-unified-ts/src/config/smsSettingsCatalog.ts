export type SmsChannel = "sms" | "email";

export interface SmsTemplateEventConfig {
  id: string;
  eventName: string;
  trigger: string;
  enabled: boolean;
  channel: SmsChannel;
  template: string;
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
      },
      {
        id: "finder-followup",
        eventName: "Follow-up reminder",
        trigger:
          "No booking within follow-up window.",
        enabled: true,
        channel: "sms",
        template:
          "Hi {{first_name}}, we wanted to follow up and see if you're ready to book your visit. Our team can help with facials, Botox, fillers, laser treatments, and more. Book using the link below or call us at (844)344-7546. {{booking_link}}",
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
        enabled: true,
        channel: "sms",
        template:
          "Let's find the perfect products for your skin! 🧴\nTake our quiz and get expert recommendations tailored just for you:\n{{link}}",
      },
      {
        id: "skincare-quiz-results",
        eventName: "Quiz results link",
        trigger:
          "Staff sends skincare quiz message for a record that already has saved quiz results.",
        enabled: true,
        channel: "sms",
        template:
          "View your Skin Type Quiz results and personalized product recommendations: {{skin_quiz_link}}",
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
        enabled: true,
        channel: "sms",
        template:
          "The Treatment Skin Boutique: We are now utilizing a new patient tool to help track treatment progress and develop customized plans. Please complete the 5-min at-home AI facial scan prior to your next appointment: {{scan_link}}",
      },
      {
        id: "analysis-processing",
        eventName: "Scan received / processing",
        trigger: "Patient submits scan and analysis generation begins.",
        enabled: true,
        channel: "sms",
        template:
          "The Treatment Skin Boutique: Your facial scan has been completed and is being analyzed now. Due to strong demand, your results might take up to a day to deliver. We'll send you another notification when it’s ready for you to review.",
      },
      {
        id: "analysis-ready",
        eventName: "Analysis ready",
        trigger: "Analysis status changes to Ready for Review",
        enabled: true,
        channel: "sms",
        template:
          "Hi {{first_name}}, your facial analysis is ready! Click here to view it: {{analysis_link}}. Reply STOP to opt out.",
      },
      {
        id: "analysis-review-reminder",
        eventName: "Review reminder",
        trigger: "Analysis not reviewed within reminder window",
        enabled: true,
        channel: "sms",
        template:
          "Reminder: Your facial analysis is still waiting! View it here: {{analysis_link}}. Reply STOP to opt out.",
      },
      {
        id: "analysis-final-reminder",
        eventName: "Final reminder",
        trigger: "Analysis still not opened by final reminder window.",
        enabled: true,
        channel: "sms",
        template:
          "Final reminder: Your analysis is still available. Don’t miss it! {{analysis_link}}. Reply STOP to opt out.",
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
      },
      {
        id: "plan-followup",
        eventName: "Plan follow-up",
        trigger: "No booking after plan delivery",
        enabled: true,
        channel: "sms",
        template:
          "Hi {{first_name}}, wanted to follow up on your treatment plan. Reply here if you'd like to adjust your plan or timeline.",
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

