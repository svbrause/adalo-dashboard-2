// Photo lazy loading utilities

import { Client } from '../types';
import { fetchTableRecords } from '../services/api';

// Track photo requests to avoid duplicates
const photoRequestedIds = new Set<string>();
let photoRequestInProgress = false;

/** URLs that returned 410/404 in this session — do not request again. */
const failedPhotoUrls = new Set<string>();

export type FrontPhotoDisplayOptions = {
  /**
   * When true, Airtable attachment CDN URLs may be returned (e.g. just fetched from the API).
   * Default false so stale links from cached Airtable records are not loaded in the browser.
   */
  allowExpiringAirtableCdn?: boolean;
};

/**
 * Airtable attachment download links expire (~2h). Records often store expired URLs.
 * @see https://support.airtable.com/docs/en/airtable-attachment-url-behavior
 */
export function isExpiringAirtableAttachmentUrl(url: string): boolean {
  try {
    const host = new URL(url, window.location.origin).hostname.toLowerCase();
    return (
      host.includes("airtableusercontent.com") ||
      host === "dl.airtable.com" ||
      host.endsWith(".airtable.com")
    );
  } catch {
    return /airtableusercontent\.com/i.test(url);
  }
}

/**
 * Parse the expiry epoch (ms) embedded in an Airtable CDN URL.
 * Format: /v3/u/{uid}/{uid}/{EXPIRY_MS}/...
 * Returns null for non-Airtable or unrecognised URL formats.
 */
export function airtableUrlExpiresAt(url: string): number | null {
  const m = url.match(/\/v[23456789]\/u\/\d+\/\d+\/(\d{10,})\//);
  return m ? parseInt(m[1], 10) : null;
}

/** True when an Airtable URL's expiry timestamp is in the past (or within 5 min). */
export function isAirtableUrlStale(url: string, bufferMs = 5 * 60 * 1000): boolean {
  const expiresAt = airtableUrlExpiresAt(url);
  if (expiresAt === null) return false;
  return Date.now() + bufferMs >= expiresAt;
}

export function markPhotoDisplayUrlFailed(url: string): void {
  const u = url?.trim();
  if (u) failedPhotoUrls.add(u);
}

export function isPhotoDisplayUrlFailed(url: string): boolean {
  return failedPhotoUrls.has(url.trim());
}

export function sanitizePhotoDisplayUrl(
  url: string | null | undefined,
  options?: FrontPhotoDisplayOptions,
): string | null {
  const u = url?.trim();
  if (!u) return null;
  if (isPhotoDisplayUrlFailed(u)) return null;
  // Always reject stale Airtable URLs regardless of allowExpiringAirtableCdn —
  // a 410 produces a CORS error in the browser before we can handle it.
  if (isExpiringAirtableAttachmentUrl(u) && isAirtableUrlStale(u)) return null;
  if (!options?.allowExpiringAirtableCdn && isExpiringAirtableAttachmentUrl(u)) {
    return null;
  }
  return u;
}

function extractUrlFromAttachment(attachment: {
  thumbnails?: { large?: { url?: string }; full?: { url?: string } };
  url?: string;
}): string | null {
  return (
    attachment?.thumbnails?.large?.url ||
    attachment?.thumbnails?.full?.url ||
    attachment?.url ||
    null
  );
}

/**
 * Check if a client should have photos loaded (only for "started" or "pending" status)
 */
export function shouldLoadPhotoForClient(client: Client): boolean {
  // Only Patients table clients can have photos
  if (client.tableSource !== 'Patients') {
    return false;
  }
  
  // Get facial analysis status
  const status = client.facialAnalysisStatus;
  
  // Skip if status is null, empty, or "not-started"
  if (!status || (typeof status === 'string' && status.trim() === '')) {
    return false; // Not started
  }
  
  const normalized = String(status).trim().toLowerCase();
  if (normalized === 'not-started') {
    return false;
  }
  
  // Load photos for "pending" or any other status (meaning they've started)
  return true;
}

/**
 * Display URL for a client's front photo: Airtable attachment array, or a direct HTTPS/HTTP URL string
 * (e.g. Wellnest demo clients). Runtime `Client.frontPhoto` may be an array despite the type alias.
 */
export function getClientFrontPhotoDisplayUrl(
  frontPhoto: unknown,
  options?: FrontPhotoDisplayOptions,
): string | null {
  if (!frontPhoto) return null;
  if (typeof frontPhoto === "string") {
    return sanitizePhotoDisplayUrl(frontPhoto, options);
  }
  if (Array.isArray(frontPhoto) && frontPhoto.length > 0) {
    const attachment = frontPhoto[0] as {
      thumbnails?: { large?: { url?: string }; full?: { url?: string } };
      url?: string;
    };
    return sanitizePhotoDisplayUrl(extractUrlFromAttachment(attachment), options);
  }
  return null;
}

/**
 * Display URL from data already on the client (list/kanban fetch includes attachments).
 * Uses Airtable CDN URLs when present — avoids a second API round-trip on detail open.
 */
export function resolveClientFrontPhotoDisplayUrl(client: Client): string | null {
  return getClientFrontPhotoDisplayUrl(client.frontPhoto, {
    allowExpiringAirtableCdn: true,
  });
}

/** True when the client has a cached Airtable photo URL that has already expired. */
export function clientHasStaleAirtablePhoto(client: Client): boolean {
  if (!client.frontPhoto) return false;
  const urls: string[] = [];
  if (typeof client.frontPhoto === "string") {
    urls.push(client.frontPhoto);
  } else if (Array.isArray(client.frontPhoto)) {
    for (const a of client.frontPhoto as { url?: string; thumbnails?: { large?: { url?: string }; full?: { url?: string } } }[]) {
      if (a?.thumbnails?.large?.url) urls.push(a.thumbnails.large.url);
      else if (a?.thumbnails?.full?.url) urls.push(a.thumbnails.full.url);
      else if (a?.url) urls.push(a.url);
    }
  }
  return urls.some((u) => isExpiringAirtableAttachmentUrl(u) && isAirtableUrlStale(u));
}

/**
 * Reset stale Airtable photo data on a batch of clients so loadVisibleClientPhotos
 * will re-fetch them.  Call before loadVisibleClientPhotos when you suspect expiry.
 */
export function clearStaleClientPhotos(clients: Client[]): Client[] {
  const stale: Client[] = [];
  for (const client of clients) {
    if (clientHasStaleAirtablePhoto(client)) {
      client.frontPhoto = null;
      client.frontPhotoLoaded = false;
      photoRequestedIds.delete(client.id);
      stale.push(client);
    }
  }
  return stale;
}

/** True only when we have no front-photo payload and must hit Airtable. */
export function clientNeedsFreshFrontPhotoUrl(client: Client): boolean {
  if (client.tableSource !== "Patients" || !shouldLoadPhotoForClient(client)) {
    return false;
  }
  if (resolveClientFrontPhotoDisplayUrl(client)) return false;
  if (Array.isArray(client.frontPhoto) && client.frontPhoto.length > 0) {
    return false;
  }
  if (typeof client.frontPhoto === "string" && client.frontPhoto.trim()) {
    return false;
  }
  return true;
}

const preloadedPhotoUrls = new Set<string>();

/** Decode image in the background so detail open feels instant when URL is known. */
export function preloadClientFrontPhotoImage(
  url: string | null | undefined,
  priority: "high" | "low" = "low",
): void {
  const u = url?.trim();
  if (!u || preloadedPhotoUrls.has(u) || isPhotoDisplayUrlFailed(u)) return;
  preloadedPhotoUrls.add(u);
  const img = new Image();
  img.decoding = "async";
  if ("fetchPriority" in img) {
    (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority =
      priority;
  }
  img.src = u;
}

/** Resolve URL from cached client row and warm the browser image cache. */
export function warmClientFrontPhoto(client: Client, priority: "high" | "low" = "low"): string | null {
  if (!shouldLoadPhotoForClient(client)) return null;
  const url = resolveClientFrontPhotoDisplayUrl(client);
  if (url) {
    preloadClientFrontPhotoImage(url, priority);
    client.frontPhotoLoaded = true;
  }
  return url;
}

/**
 * Fetch front photo for a client (single client)
 */
export async function fetchClientFrontPhoto(clientId: string): Promise<any[] | null> {
  try {
    const records = await fetchTableRecords('Patients', {
      filterFormula: `RECORD_ID() = "${clientId}"`,
      fields: ['Front Photo'],
    });
    
    if (records.length === 0) return null;
    
    const record = records[0];
    const frontPhoto = record.fields['Front Photo'] || record.fields['Front photo'] || record.fields['frontPhoto'];
    
    if (!frontPhoto) return null;
    
    // Handle Airtable attachment format
    if (Array.isArray(frontPhoto) && frontPhoto.length > 0) {
      return frontPhoto;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching front photo:', error);
    return null;
  }
}

/**
 * Batch fetch photos for multiple clients (efficient)
 * Uses OR formula for small batches, pagination for large batches
 */
export async function batchFetchClientPhotos(
  clientIds: string[],
  providerId?: string
): Promise<Map<string, unknown>> {
  if (!clientIds || clientIds.length === 0) {
    return new Map();
  }
  
  // Filter out IDs that have already been requested (avoid duplicate calls)
  const uniqueIds = clientIds.filter(id => !photoRequestedIds.has(id));
  if (uniqueIds.length === 0) {
    return new Map(); // All IDs already requested
  }
  
  // Mark these as requested
  uniqueIds.forEach(id => photoRequestedIds.add(id));
  
  const photoMap = new Map<string, unknown>();
  
  // For small batches (≤10), use OR formula (more efficient)
  if (uniqueIds.length <= 10) {
    try {
      const orConditions = uniqueIds.map(id => `RECORD_ID()="${id}"`).join(', ');
      const filterFormula = `OR(${orConditions})`;
      
      const records = await fetchTableRecords('Patients', {
        filterFormula,
        fields: ['Front Photo'],
        providerId,
      });
      
      records.forEach(record => {
        const frontPhoto = record.fields['Front Photo'] || record.fields['Front photo'];
        if (frontPhoto && Array.isArray(frontPhoto) && frontPhoto.length > 0) {
          photoMap.set(record.id, frontPhoto);
        } else if (frontPhoto && typeof frontPhoto === 'string') {
          photoMap.set(record.id, frontPhoto);
        }
      });
      
      console.log(`📸 Batch loaded ${photoMap.size} photos using OR formula`);
      return photoMap;
    } catch (error) {
      console.error('Error batch fetching photos with OR formula:', error);
      // Remove from requested set on error so we can retry
      uniqueIds.forEach(id => photoRequestedIds.delete(id));
      return photoMap;
    }
  }
  
  // For larger batches, use pagination with providerId filter
  try {
    // Build filter: providerId AND (status is not null/empty AND status is not "not-started")
    const providerFilter = providerId 
      ? `FIND("${providerId}", ARRAYJOIN({Record ID (from Providers)})) > 0`
      : null;
    
    const statusFilter = `AND(
      {Pending/Opened} != "",
      {Pending/Opened} != "not-started"
    )`;
    
    const filterFormula = providerFilter 
      ? `AND(${providerFilter}, ${statusFilter})`
      : statusFilter;
    
    const targetClientIds = new Set(uniqueIds);
    let allRecords: any[] = [];
    let offset: string | null = null;
    let pageCount = 0;
    const maxPages = 10;
    let foundCount = 0;
    
    do {
      pageCount++;
      const records = await fetchTableRecords('Patients', {
        filterFormula,
        fields: ['Front Photo'],
        providerId,
      });
      
      // Filter to only records we're looking for
      const matchingRecords = records.filter(record => targetClientIds.has(record.id));
      allRecords = allRecords.concat(matchingRecords);
      foundCount += matchingRecords.length;
      
      // If we've found all the clients we're looking for, we can stop early
      if (foundCount >= uniqueIds.length) {
        console.log(`✅ Found all ${foundCount} photos in ${pageCount} page(s)`);
        break;
      }
      
      if (pageCount >= maxPages) {
        console.warn(`Reached max pages limit for photo fetching (found ${foundCount}/${clientIds.length})`);
        break;
      }
      
      // Note: fetchTableRecords doesn't return offset, so we'll need to handle pagination differently
      // For now, we'll just fetch once and filter
      break;
    } while (offset);
    
    allRecords.forEach(record => {
      const frontPhoto = record.fields['Front Photo'] || record.fields['Front photo'];
      if (frontPhoto && Array.isArray(frontPhoto) && frontPhoto.length > 0) {
        photoMap.set(record.id, frontPhoto);
      } else if (frontPhoto && typeof frontPhoto === 'string') {
        photoMap.set(record.id, frontPhoto);
      }
    });
    
    console.log(`📸 Loaded photos for ${photoMap.size} clients using pagination (${pageCount} page(s))`);
    return photoMap;
  } catch (error) {
    console.error('Error batch fetching photos with pagination:', error);
    // Remove from requested set on error so we can retry
    uniqueIds.forEach(id => photoRequestedIds.delete(id));
  }
  
  return photoMap;
}

/**
 * Preload photos for visible clients in a view
 */
export async function preloadVisiblePhotos(
  clients: Client[],
  providerId?: string
): Promise<void> {
  for (const client of clients) {
    if (!client.frontPhotoLoaded) {
      warmClientFrontPhoto(client, "low");
    }
  }

  // Prevent concurrent requests
  if (photoRequestInProgress) {
    return;
  }
  
  // Filter to only Patients clients that:
  // 1. Should have photos (started/pending status)
  // 2. Don't have photos loaded yet
  // 3. Haven't been requested yet (to avoid duplicate API calls)
  const patientsWithoutPhotos = clients.filter(
    client => shouldLoadPhotoForClient(client) &&
              !client.frontPhotoLoaded && 
              (!client.frontPhoto || (Array.isArray(client.frontPhoto) && client.frontPhoto.length === 0)) &&
              !photoRequestedIds.has(client.id)
  );
  
  if (patientsWithoutPhotos.length === 0) {
    return; // All visible photos already loaded or requested
  }
  
  // Mark these IDs as requested to prevent duplicate calls
  patientsWithoutPhotos.forEach(client => {
    photoRequestedIds.add(client.id);
  });
  
  console.log(`📸 Pre-loading photos for ${patientsWithoutPhotos.length} visible Patients clients...`);
  
  // Set flag to prevent concurrent requests
  photoRequestInProgress = true;
  
  try {
    // Fetch photos for visible clients (non-blocking)
    const batchIds = patientsWithoutPhotos.map(c => c.id);
    const photoMap = await batchFetchClientPhotos(batchIds, providerId);
    
    // Update clients with their photos
    photoMap.forEach((photo, clientId) => {
      const client = patientsWithoutPhotos.find(c => c.id === clientId);
      if (client) {
        client.frontPhoto = photo as Client["frontPhoto"];
        client.frontPhotoLoaded = true;
      }
    });
  } catch (err) {
    console.warn(`Failed to preload photos for visible clients:`, err);
    // Remove from requested set on error so we can retry later
    patientsWithoutPhotos.forEach(client => photoRequestedIds.delete(client.id));
  } finally {
    photoRequestInProgress = false;
  }
}

/**
 * Clear photo request tracking (useful for testing or reset)
 */
export function clearPhotoRequestTracking(): void {
  photoRequestedIds.clear();
  photoRequestInProgress = false;
  failedPhotoUrls.clear();
  preloadedPhotoUrls.clear();
}
