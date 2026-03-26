/**
 * Local demo photo URLs for Wellnest sample patients (public assets).
 * These clients are not Airtable-backed, so side/front fallbacks use this map.
 */
export const WELLNEST_DEMO_PHOTOS_BY_CLIENT_ID: Record<
  string,
  { front: string; side: string }
> = {
  "wellnest-demo-alex": {
    front: "/post-visit-blueprint/videos/wellnest/patient-photos/taylor-morgan/front.jpeg",
    side: "/post-visit-blueprint/videos/wellnest/patient-photos/taylor-morgan/side.jpeg",
  },
  "wellnest-demo-jordan": {
    front: "/post-visit-blueprint/videos/wellnest/patient-photos/jordan-lee/front.png",
    side: "/post-visit-blueprint/videos/wellnest/patient-photos/jordan-lee/side.png",
  },
  "wellnest-demo-taylor": {
    front: "/post-visit-blueprint/videos/wellnest/patient-photos/alex-rivera/front.png",
    side: "/post-visit-blueprint/videos/wellnest/patient-photos/alex-rivera/side.png",
  },
};

export function getWellnestDemoPhotoUrls(clientId: string | null | undefined): {
  front: string;
  side: string;
} | null {
  if (!clientId) return null;
  return WELLNEST_DEMO_PHOTOS_BY_CLIENT_ID[clientId] ?? null;
}
