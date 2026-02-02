// Issue to Area mapping and utilities

// Issue to Area mapping from CSV
export const issueToAreaMap: Record<string, string> = {
  "Forehead Wrinkles": "Skin",
  "Crow's Feet Wrinkles": "Skin",
  "Glabella Wrinkles": "Skin",
  "Under Eye Wrinkles": "Skin",
  "Perioral Wrinkles": "Skin",
  "Bunny Lines": "Skin",
  "Neck Lines": "Skin",
  "Dark Spots": "Skin",
  "Red Spots": "Skin",
  "Acne [DEPRECATED]": "Skin",
  "Scars": "Skin",
  "Dry Skin": "Skin",
  "Oily": "Skin",
  "Whiteheads": "Skin",
  "Blackheads": "Skin",
  "Under Eye Dark Circles": "Eyes",
  "Crepey Skin": "Skin",
  "Rosacea [DEPRECATED]": "Skin",
  "Nasolabial Folds": "Skin",
  "Marionette Lines": "Skin",
  "Temporal Hollow": "Forehead",
  "Brow Asymmetry": "Forehead",
  "Flat Forehead": "Forehead",
  "Brow Ptosis": "Forehead",
  "Excess Upper Eyelid Skin": "Eyes",
  "Lower Eyelid - Excess Skin": "Eyes",
  "Upper Eyelid Droop": "Eyes",
  "Lower Eyelid Sag": "Eyes",
  "Lower Eyelid Bags": "Eyes",
  "Under Eye Hollow": "Eyes",
  "Upper Eye Hollow": "Eyes",
  "Negative Canthal Tilt": "Eyes",
  "Mid Cheek Flattening": "Cheeks",
  "Cheekbone - Not Prominent": "Cheeks",
  "Heavy Lateral Cheek": "Cheeks",
  "Crooked Nose": "Nose",
  "Droopy Tip": "Nose",
  "Dorsal Hump": "Nose",
  "Over-Projected": "Nose",
  "Under-Projected": "Nose",
  "Over-Rotated": "Nose",
  "Under-Rotated": "Nose",
  "Tip Droop When Smiling": "Nose",
  "Nasal Bone - Too Wide": "Nose",
  "Nostril Base - Too Wide": "Nose",
  "Nasal Tip Too Narrow": "Nose",
  "Nasal Tip Too Wide": "Nose",
  "Thin Lips": "Lips",
  "Lacking Philtral Column": "Lips",
  "Long Philtral Column": "Lips",
  "Gummy Smile": "Lips",
  "Asymmetric Lips": "Lips",
  "Dry Lips": "Lips",
  "Lip Thinning When Smiling": "Lips",
  "Wide Chin": "Jawline",
  "Retruded Chin": "Jawline",
  "Over-Projected Chin": "Jawline",
  "Asymmetric Chin": "Jawline",
  "Jowls": "Jawline",
  "Lower Cheeks - Over-Filled": "Jawline",
  "Lower Cheeks - Volume Depletion": "Jawline",
  "Ill-Defined Jawline": "Jawline",
  "Wide Jawline": "Jawline",
  "Narrow Jawline": "Jawline",
  "Asymmetric Jawline": "Jawline",
  "Masseter Hypertrophy": "Jawline",
  "Prejowl Sulcus": "Jawline",
  "Loose Neck Skin": "Jawline",
  "Platysmal Bands": "Jawline",
  "Excess/Submental Fullness": "Jawline",
};

// Issue to Suggestion mapping
export const issueToSuggestionMap: Record<string, string> = {
  "Forehead Wrinkles": "Smoothen Fine Lines",
  "Crow's Feet Wrinkles": "Smoothen Fine Lines",
  "Glabella Wrinkles": "Smoothen Fine Lines",
  "Under Eye Wrinkles": "Smoothen Fine Lines",
  "Perioral Wrinkles": "Smoothen Fine Lines",
  "Bunny Lines": "Smoothen Fine Lines",
  "Neck Lines": "Smoothen Fine Lines",
  "Dark Spots": "Even Skin Tone",
  "Red Spots": "Even Skin Tone",
  "Scars": "Fade Scars",
  "Dry Skin": "Hydrate Skin",
  "Whiteheads": "Exfoliate Skin",
  "Blackheads": "Exfoliate Skin",
  "Under Eye Dark Circles": "Rejuvenate Lower Eyelids",
  "Crepey Skin": "Tighten Skin Laxity",
  "Nasolabial Folds": "Shadow Correction",
  "Marionette Lines": "Shadow Correction",
  "Temporal Hollow": "Balance Forehead",
  "Brow Asymmetry": "Balance Brows",
  "Flat Forehead": "Balance Forehead",
  "Brow Ptosis": "Balance Brows",
  "Excess Upper Eyelid Skin": "Rejuvenate Upper Eyelids",
  "Lower Eyelid - Excess Skin": "Rejuvenate Lower Eyelids",
  "Upper Eyelid Droop": "Rejuvenate Upper Eyelids",
  "Lower Eyelid Sag": "Rejuvenate Lower Eyelids",
  "Lower Eyelid Bags": "Rejuvenate Lower Eyelids",
  "Under Eye Hollow": "Rejuvenate Lower Eyelids",
  "Upper Eye Hollow": "Rejuvenate Upper Eyelids",
  "Mid Cheek Flattening": "Improve Cheek Definition",
  "Cheekbone - Not Prominent": "Improve Cheek Definition",
  "Heavy Lateral Cheek": "Contour Cheeks",
  "Crooked Nose": "Balance Nose",
  "Droopy Tip": "Balance Nose",
  "Dorsal Hump": "Balance Nose",
  "Tip Droop When Smiling": "Balance Nose",
  "Thin Lips": "Balance Lips",
  "Lacking Philtral Column": "Balance Lips",
  "Long Philtral Column": "Balance Lips",
  "Gummy Smile": "Balance Lips",
  "Asymmetric Lips": "Balance Lips",
  "Dry Lips": "Hydrate Lips",
  "Lip Thinning When Smiling": "Balance Lips",
  "Retruded Chin": "Balance Jawline",
  "Over-Projected Chin": "Contour Jawline",
  "Asymmetric Chin": "Balance Jawline",
  "Jowls": "Contour Jawline",
  "Lower Cheeks - Volume Depletion": "Improve Cheek Definition",
  "Ill-Defined Jawline": "Contour Jawline",
  "Asymmetric Jawline": "Balance Jawline",
  "Masseter Hypertrophy": "Contour Jawline",
  "Prejowl Sulcus": "Balance Jawline",
  "Loose Neck Skin": "Contour Neck",
  "Platysmal Bands": "Contour Neck",
  "Excess/Submental Fullness": "Contour Jawline",
};

/**
 * Map an issue name to its area
 */
export function getIssueArea(issueName: string): string {
  const normalizedIssue = issueName.trim();
  
  // First check the CSV-based mapping
  if (issueToAreaMap[normalizedIssue]) {
    return issueToAreaMap[normalizedIssue];
  }
  
  // Check each area's issues (case-insensitive)
  for (const [issue, area] of Object.entries(issueToAreaMap)) {
    if (issue.toLowerCase() === normalizedIssue.toLowerCase()) {
      return area;
    }
  }
  
  // If not found in mapping, try to infer from name
  const issueLower = normalizedIssue.toLowerCase();
  if (issueLower.includes('forehead') || issueLower.includes('brow') || issueLower.includes('glabella') || issueLower.includes('temporal')) {
    return 'Forehead';
  } else if (issueLower.includes('eye') || issueLower.includes('eyelid') || issueLower.includes('crow')) {
    return 'Eyes';
  } else if (issueLower.includes('cheek')) {
    return 'Cheeks';
  } else if (issueLower.includes('nose') || issueLower.includes('nasal')) {
    return 'Nose';
  } else if (issueLower.includes('lip') || issueLower.includes('mouth') || issueLower.includes('philtral') || issueLower.includes('gummy')) {
    return 'Lips';
  } else if (issueLower.includes('chin') || issueLower.includes('jaw') || issueLower.includes('jowl') || issueLower.includes('masseter')) {
    return 'Jawline';
  } else if (issueLower.includes('neck') || issueLower.includes('platysmal') || issueLower.includes('submental')) {
    return 'Jawline'; // Neck issues map to Jawline per CSV
  } else if (issueLower.includes('spot') || issueLower.includes('scar') || issueLower.includes('skin') || issueLower.includes('wrinkle') || issueLower.includes('line') || issueLower.includes('fold')) {
    return 'Skin';
  } else if (issueLower.includes('hair') || issueLower.includes('fat') || issueLower.includes('body')) {
    return 'Body';
  }
  
  return 'Other'; // Default category for unmapped issues
}

/**
 * Group issues by area
 */
export function groupIssuesByArea(issuesString: string | string[] | null): Record<string, string[]> {
  if (!issuesString) return {};
  
  const issues = Array.isArray(issuesString) 
    ? issuesString 
    : typeof issuesString === 'string' 
      ? issuesString.split(',').map(issue => issue.trim()).filter(issue => issue)
      : [];
  
  const grouped: Record<string, string[]> = {};
  issues.forEach(issue => {
    const area = getIssueArea(issue);
    if (!grouped[area]) {
      grouped[area] = [];
    }
    grouped[area].push(issue);
  });
  
  return grouped;
}
