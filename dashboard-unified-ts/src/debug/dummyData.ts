/**
 * Dummy data for debug pages so we can test Treatment Examples and Treatment Plan
 * without provider login or live API. Uses placeholder images so layout is visible.
 */

import type { Client } from "../types";
import type { DiscussedItem } from "../types";
import type { TreatmentPhoto } from "../types";

const PLACEHOLDER = "https://placehold.co/400x400/e8e8e8/666?text=Example";

/** Mock client for Treatment Plan popup */
export function getDummyClient(): Client {
  return {
    id: "debug-patient-1",
    name: "Sasha Jones",
    email: "sasha@example.com",
    phone: "+1 555 123 4567",
    zipCode: "90210",
    age: 34,
    ageRange: "30-39",
    dateOfBirth: null,
    goals: ["Balance Lips", "Smoothen Fine Lines"],
    concerns: "",
    areas: ["Lips", "Forehead"],
    aestheticGoals: "",
    skinType: "Combination",
    skinTone: "Light",
    ethnicBackground: null,
    engagementLevel: null,
    casesViewedCount: null,
    totalCasesAvailable: null,
    concernsExplored: null,
    photosLiked: 0,
    photosViewed: 0,
    treatmentsViewed: [],
    source: "Patients",
    status: "scheduled",
    priority: "medium",
    createdAt: new Date().toISOString(),
    notes: "",
    appointmentDate: null,
    treatmentReceived: null,
    revenue: null,
    lastContact: null,
    isReal: false,
    tableSource: "Patients",
    facialAnalysisStatus: "pending",
    frontPhoto: null,
    frontPhotoLoaded: false,
    allIssues:
      "Forehead Wrinkles, Crow's Feet Wrinkles, Under Eye Dark Circles, Mid Cheek Flattening, Nasolabial Folds, Thin Lips, Asymmetric Lips, Jowls, Marionette Lines, Dark Spots, Crepey Skin",
    interestedIssues:
      "Balance Lips, Smoothen Fine Lines, Volume enhancement, Anti-aging",
    whichRegions: "Lips, Forehead",
    skinComplaints: "",
    processedAreasOfInterest: "",
    areasOfInterestFromForm: "",
    archived: false,
    offerClaimed: false,
    offerExpirationDate: null,
    locationName: null,
    appointmentStaffName: null,
    discussedItems: getDummyDiscussedItems(),
    contactHistory: [],
  };
}

/** Mock discussed items for the treatment plan */
export function getDummyDiscussedItems(): DiscussedItem[] {
  return [
    {
      id: "debug-item-1",
      treatment: "Neurotoxin",
      interest: "Smoothen Fine Lines",
      region: "Forehead",
      timeline: "Now",
      product: "OnabotulinumtoxinA (Botox)",
      quantity: "20",
      notes: "",
    },
    {
      id: "debug-item-2",
      treatment: "Filler",
      interest: "Balance Lips",
      region: "Lips",
      timeline: "Add next visit",
      product: "Hyaluronic acid (HA) – lip",
      quantity: "1",
      notes: "",
    },
    {
      id: "debug-item-3",
      treatment: "Skincare",
      product: "Retinol",
      timeline: "Wishlist",
      notes: "Post care for Neurotoxin",
    },
  ];
}

/** Mock treatment photos so the Treatment Examples gallery always has visible cards */
export function getDummyTreatmentPhotos(): TreatmentPhoto[] {
  const treatments = [
    {
      name: "Filler",
      area: "Lips",
      longevity: "6–18 months",
      downtime: "1–2 days",
      price: "$500–$2,000+",
    },
    {
      name: "Neurotoxin",
      area: "Forehead",
      longevity: "3–4 months",
      downtime: "None",
      price: "$300–$600",
    },
    {
      name: "Filler",
      area: "Cheeks",
      longevity: "6–18 months",
      downtime: "1–2 days",
      price: "$500–$2,000+",
    },
    {
      name: "Laser",
      area: "Nasolabial",
      longevity: "6–12+ months",
      downtime: "3–7 days",
      price: "$200–$800+",
    },
    {
      name: "Neurotoxin",
      area: "Crow's feet",
      longevity: "3–4 months",
      downtime: "None",
      price: "$300–$600",
    },
    {
      name: "Microneedling",
      area: "Cheeks",
      longevity: "2–4 months",
      downtime: "1–3 days",
      price: "$200–$500",
    },
    {
      name: "Chemical Peel",
      area: "Other",
      longevity: "1–3 months",
      downtime: "3–7 days",
      price: "$100–$300",
    },
    {
      name: "Skincare",
      area: "Other",
      longevity: "Ongoing",
      downtime: "None",
      price: "Varies",
    },
  ];
  return treatments.map((t, i) => ({
    id: `debug-photo-${i + 1}`,
    name: `${t.name} – ${t.area}`,
    photoUrl: PLACEHOLDER,
    thumbnailUrl: PLACEHOLDER,
    treatments: [t.name],
    generalTreatments: [t.name],
    areaNames: [t.area],
    surgical: "Non-Surgical",
    caption: `Example result for ${t.name} in ${t.area}.`,
    storyTitle: `${t.name} – ${t.area}`,
    storyDetailed: `Demo photo for layout testing. Longevity: ${t.longevity}. Downtime: ${t.downtime}.`,
    longevity: t.longevity,
    downtime: t.downtime,
    priceRange: t.price,
    age: "30s",
    skinType: "Combination",
    skinTone: "Light",
  }));
}
