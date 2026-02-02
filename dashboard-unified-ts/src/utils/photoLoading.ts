// Photo lazy loading utilities

import { Client } from '../types';
import { fetchTableRecords } from '../services/api';

// Track photo requests to avoid duplicates
const photoRequestedIds = new Set<string>();
let photoRequestInProgress = false;

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
): Promise<Map<string, string>> {
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
  
  const photoMap = new Map<string, string>();
  
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
          // Extract URL from Airtable attachment array
          const photoUrl = typeof frontPhoto[0] === 'string' 
            ? frontPhoto[0] 
            : frontPhoto[0]?.url || frontPhoto[0]?.thumbnails?.large?.url || '';
          if (photoUrl) {
            photoMap.set(record.id, photoUrl);
          }
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
        // Extract URL from Airtable attachment array
        const photoUrl = typeof frontPhoto[0] === 'string' 
          ? frontPhoto[0] 
          : frontPhoto[0]?.url || frontPhoto[0]?.thumbnails?.large?.url || '';
        if (photoUrl) {
          photoMap.set(record.id, photoUrl);
        }
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
        client.frontPhoto = photo;
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
}
