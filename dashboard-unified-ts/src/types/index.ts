// Type definitions for the Unified Dashboard

export interface Provider {
  id: string;
  name: string;
  code: string;
  /** When set, leads/patients are fetched for all these IDs (merge group). Backend returns this for e.g. TheTreatment250/TheTreatment447 so both codes see the same combined list. */
  mergedProviderIds?: string[];
  logo?:
    | string
    | Array<{
        url: string;
        thumbnails?: { large?: { url: string }; full?: { url: string } };
      }>;
  "Form Link"?: string;
  FormLink?: string;
  "Web Link"?: string;
  WebLink?: string;
  JotformURL?: string;
  SCAN_FORM_URL?: string;
  [key: string]: any; // Allow additional fields from Airtable
}

/** One item (treatment/product) discussed with the patient in clinic */
export interface DiscussedItem {
  id: string;
  /** ISO date string when this item was added to the plan */
  addedAt?: string;
  /** High-level treatment interest from analysis (e.g. "Improve Cheek Definition") that this treatment addresses */
  interest?: string;
  /** Detected issues linked to this item (e.g. "Forehead Wrinkles") when added by patient interest */
  findings?: string[];
  treatment: string;
  /** When treatment is Skincare, optional product type (e.g. Retinol, Vitamin C) */
  product?: string;
  brand?: string;
  region?: string;
  timeline?: string;
  /** Quantity (e.g. syringes, units) – quick-select in UI */
  quantity?: string;
  recurring?: string;
  notes?: string;
}

/** Treatment photo from the Photos table (before/after examples) */
export interface TreatmentPhoto {
  id: string;
  name: string;
  photoUrl: string;
  thumbnailUrl?: string;
  treatments: string[];
  generalTreatments: string[];
  areaNames: string[];
  /** "Surgical" or "Non-Surgical" from Photos table – used to filter to non-surgical only */
  surgical?: string;
  caption?: string;
  storyTitle?: string;
  storyDetailed?: string;
  longevity?: string;
  downtime?: string;
  priceRange?: string;
  /** Patient demographics for matching */
  age?: string;
  skinTone?: string;
  ethnicBackground?: string;
  skinType?: string;
}

export interface ContactHistoryEntry {
  id: string;
  leadId: string;
  type: "call" | "email" | "text" | "meeting";
  outcome:
    | "reached"
    | "voicemail"
    | "no-answer"
    | "scheduled"
    | "sent"
    | "replied"
    | "attended"
    | "no-show"
    | "cancelled";
  notes: string;
  date: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  zipCode: string | null;
  age: number | null;
  ageRange: string | null;
  dateOfBirth: string | null;
  goals: string[];
  /** Patients: parsed from Airtable "Wellness Goals" (long text, multi-select, or JSON array). Shown under Wellness → Goals from intake. */
  wellnessGoals: string[];
  concerns: string | string[];
  areas: string[] | null;
  aestheticGoals: string;
  skinType: string | null;
  skinTone: string | null;
  ethnicBackground: string | null;
  engagementLevel: string | null;
  casesViewedCount: number | null;
  totalCasesAvailable: number | null;
  concernsExplored: string[] | null;
  photosLiked: number;
  photosViewed: number;
  treatmentsViewed: string[];
  source: string;
  status: "new" | "contacted" | "requested-consult" | "scheduled" | "converted" | "current-client";
  priority: "high" | "medium" | "low";
  createdAt: string;
  notes: string;
  appointmentDate: string | null;
  treatmentReceived: string | null;
  revenue: number | null;
  lastContact: string | null;
  isReal: boolean;
  tableSource: "Web Popup Leads" | "Patients";
  facialAnalysisStatus: string | null;
  frontPhoto: string | null;
  frontPhotoLoaded: boolean;
  allIssues: string;
  interestedIssues: string;
  whichRegions: string;
  skinComplaints: string;
  processedAreasOfInterest: string;
  areasOfInterestFromForm: string;
  archived: boolean;
  offerClaimed: boolean;
  /** Whether the $50 coupon was earned (e.g. completed online treatment finder). When undefined, treated as true for Web Popup Leads. */
  offerEarned?: boolean;
  /** Offer/coupon expiration date (e.g. $50 off). ISO date string or null. */
  offerExpirationDate: string | null;
  /** Patients: Location name from Boulevard Appointments (from Form Submissions) */
  locationName: string | null;
  /** Patients: Appointment service staff name (first + last from Boulevard Appointments) */
  appointmentStaffName: string | null;
  /** Treatments/products discussed with patient in clinic (optional; persisted as "Treatments Discussed" in Airtable) */
  discussedItems?: DiscussedItem[];
  contactHistory: ContactHistoryEntry[];
  /** When set, this client was consolidated from a Web Popup Lead (id) + Patient; UI shows one row. Updates/links use this client's id (Patient). */
  linkedLeadId?: string;
  /** Skincare quiz result (from "Skincare Quiz" long text field in Airtable – JSON). Same field name in Patients and Web Popup Leads. */
  skincareQuiz?: SkincareQuizData | null;
  /** Wellness quiz result (from "Wellness Quiz" long text field in Airtable – JSON). Peptide/treatment suggestions from Dr Reddy offerings. */
  wellnessQuiz?: WellnessQuizData | null;
}

/**
 * Stored in Airtable "Wellness Quiz" long text field (JSON).
 * Suggested treatments are resolved from wellnessQuiz.ts by suggestedTreatmentIds.
 */
export interface WellnessQuizData {
  version: 1;
  completedAt: string;
  answers: Record<string, number | number[]>;
  suggestedTreatmentIds: string[];
}

/**
 * Stored in Airtable "Skincare Quiz" long text field (JSON).
 * Use in both Patients and Web Popup Leads so any user can complete the quiz.
 */
export interface SkincareQuizData {
  version: 1;
  /** When the quiz was completed (ISO date string). */
  completedAt: string;
  /** Question id → selected answer index (0-based). */
  answers: Record<string, number>;
  /** Computed gemstone skin type from quiz scoring (e.g. opal, pearl, quartz). */
  result: "opal" | "pearl" | "jade" | "quartz" | "amber" | "moonstone" | "turquoise" | "diamond";
  /** Recommended product names (optional; can be recomputed from result via getRecommendedProductsForSkinType). */
  recommendedProductNames?: string[];
  /** Human-readable result label (e.g. "Normal with sensitive tendency"). */
  resultLabel?: string;
  /** Longer description for the result; may include secondary tendency advice. */
  resultDescription?: string;
}

export interface Offer {
  id: string;
  name: string;
  heading: string;
  details: string;
  availableUntil: string;
  redemptionPeriod: string;
  treatmentFilter: string;
  createdTime?: string;
}

/** One row from the Doctor Advice Requests Airtable table (inbox). */
export interface DoctorAdviceRequest {
  id: string;
  patientEmail: string;
  patientNote: string;
  source: string;
  patientId?: string;
  createdTime?: string;
}

export type ViewType =
  | "list"
  | "cards"
  | "kanban"
  | "facial-analysis"
  | "leads"
  | "archived"
  | "offers"
  | "inbox"
  | "sms-history"
  | "settings";

export interface FilterState {
  source: string;
  ageMin: number | null;
  ageMax: number | null;
  analysisStatus: string;
  /** Whether skin analysis data exists for this client. ""=all, "has", "blank". */
  skinAnalysisState: "" | "has" | "blank";
  /** Whether treatment finder data exists for this client. ""=all, "has", "blank". */
  treatmentFinderState: "" | "has" | "blank";
  /** Whether a treatment plan exists (discussed items). ""=all, "has", "blank". */
  treatmentPlanState: "" | "has" | "blank";
  leadStage: string;
  /** Location name (e.g. Newport Beach) – from client.locationName (Patients). */
  locationName: string;
  /** Provider / staff name – from client.appointmentStaffName (Patients). */
  providerName: string;
}

export interface SortState {
  field:
    | "lastContact"
    | "name"
    | "age"
    | "status"
    | "facialAnalysisStatus"
    | "photosLiked"
    | "photosViewed"
    | "createdAt";
  order: "asc" | "desc";
}

export interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  total: number;
}

export interface DashboardState {
  clients: Client[];
  filteredClients: Client[];
  currentView: ViewType;
  searchQuery: string;
  filters: FilterState;
  sort: SortState;
  pagination: PaginationState;
  loading: boolean;
  error: string | null;
}

export interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime?: string;
}

export interface AirtableResponse {
  success: boolean;
  records: AirtableRecord[];
  count?: number;
}
