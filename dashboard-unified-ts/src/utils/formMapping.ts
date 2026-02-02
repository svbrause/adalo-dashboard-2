// Form field mapping utilities

import { Client } from '../types';

// Valid form field options
export const VALID_WHAT_AREAS = ['Face', 'Skin', 'Body', 'Wellness'];
export const VALID_FACE_REGIONS = ['Eyebrows', 'Eyes', 'Cheeks', 'Nose', 'Lips', 'Face and neck aging', 'Ears', 'Jawline/chin'];
export const VALID_SKIN_COMPLAINTS = ['Acne', 'Wrinkles', 'Pigment', 'Texture', 'Sun damage', 'Thin', 'Thick', 'Oily', 'Dry', 'Redness'];

// Map Web Popup Leads areas/concerns to form faceRegions
export const FACE_REGION_MAPPING: Record<string, string> = {
  'Eyebrows': 'Eyebrows',
  'Brow': 'Eyebrows',
  'Brows': 'Eyebrows',
  'Eyes': 'Eyes',
  'Eye': 'Eyes',
  'Under Eye': 'Eyes',
  "Crow's Feet": 'Eyes',
  'Cheeks': 'Cheeks',
  'Cheek': 'Cheeks',
  'Nose': 'Nose',
  'Bunny Lines': 'Nose',
  'Lips': 'Lips',
  'Lip': 'Lips',
  'Perioral': 'Lips',
  'Jawline': 'Jawline/chin',
  'Jaw': 'Jawline/chin',
  'Chin': 'Jawline/chin',
  'Jawline/chin': 'Jawline/chin',
  'Ears': 'Ears',
  'Ear': 'Ears',
  'Forehead': 'Face and neck aging',
  'Neck': 'Face and neck aging',
  'Neck Lines': 'Face and neck aging',
};

export function mapAreasToFormFields(client: Client): { whatAreas: string[]; faceRegions: string[] } {
  const whatAreas: string[] = [];
  const faceRegions: string[] = [];
  
  // Map areas/concerns to face regions
  const areas = client.areas || [];
  const concerns = typeof client.concerns === 'string' 
    ? client.concerns.split(',').map(c => c.trim())
    : Array.isArray(client.concerns) ? client.concerns : [];
  
  const allAreas = [...areas, ...concerns];
  
  allAreas.forEach(area => {
    const normalized = area.trim();
    const mappedRegion = FACE_REGION_MAPPING[normalized] || FACE_REGION_MAPPING[normalized.toLowerCase()];
    if (mappedRegion && VALID_FACE_REGIONS.includes(mappedRegion)) {
      if (!faceRegions.includes(mappedRegion)) {
        faceRegions.push(mappedRegion);
      }
    }
  });
  
  // Determine whatAreas based on faceRegions
  if (faceRegions.length > 0) {
    whatAreas.push('Face');
  }
  
  // Check for skin-related concerns
  const skinKeywords = ['skin', 'acne', 'wrinkle', 'pigment', 'texture', 'sun', 'oily', 'dry'];
  const hasSkinConcerns = allAreas.some(area => 
    skinKeywords.some(keyword => area.toLowerCase().includes(keyword))
  );
  if (hasSkinConcerns) {
    whatAreas.push('Skin');
  }
  
  return { whatAreas, faceRegions };
}

export function mapSkinComplaints(client: Client): string[] {
  const complaints: string[] = [];
  
  if (!client.skinComplaints) return complaints;
  
  const skinComplaintsStr = typeof client.skinComplaints === 'string' 
    ? client.skinComplaints 
    : String(client.skinComplaints);
  
  const normalized = skinComplaintsStr.toLowerCase();
  
  // Map to valid skin complaints
  if (normalized.includes('acne')) complaints.push('Acne');
  if (normalized.includes('wrinkle')) complaints.push('Wrinkles');
  if (normalized.includes('pigment') || normalized.includes('spot')) complaints.push('Pigment');
  if (normalized.includes('texture')) complaints.push('Texture');
  if (normalized.includes('sun')) complaints.push('Sun damage');
  if (normalized.includes('thin')) complaints.push('Thin');
  if (normalized.includes('thick')) complaints.push('Thick');
  if (normalized.includes('oily')) complaints.push('Oily');
  if (normalized.includes('dry')) complaints.push('Dry');
  if (normalized.includes('red')) complaints.push('Redness');
  
  return [...new Set(complaints)]; // Remove duplicates
}
