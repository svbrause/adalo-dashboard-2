import type { Client, ClientPhotoSlot } from "../types";
import { fetchTableRecords } from "../services/api";
import { getWellnestDemoPhotoUrls } from "../debug/wellnestDemoPhotos";
import {
  getClientFrontPhotoDisplayUrl,
  sanitizePhotoDisplayUrl,
} from "./photoLoading";

const TABLES_WITH_PHOTOS = ["Patients", "Web Popup Leads"] as const;

function getAttachmentUrl(attachment: {
  thumbnails?: { full?: { url: string }; large?: { url: string } };
  url?: string;
}): string | null {
  if (!attachment) return null;
  const url =
    attachment.thumbnails?.full?.url ||
    attachment.thumbnails?.large?.url ||
    attachment.url;
  return url || null;
}

function getFirstAttachmentUrl(fields: Record<string, unknown>, key: string): string | null {
  const val = fields[key];
  if (!val || !Array.isArray(val) || val.length === 0) return null;
  return getAttachmentUrl(val[0] as Parameters<typeof getAttachmentUrl>[0]);
}

function pushUnique(
  out: ClientPhotoSlot[],
  seen: Set<string>,
  slot: ClientPhotoSlot,
  options?: { allowExpiringAirtableCdn?: boolean },
) {
  const u = sanitizePhotoDisplayUrl(slot.url, options);
  if (!u || seen.has(u)) return;
  seen.add(u);
  out.push({ ...slot, url: u });
}

/**
 * Resolves every distinct patient photo angle we know about (same Airtable fields as
 * {@link PhotoViewerModal}) for the client-detail face mirror.
 */
export async function loadClientGalleryPhotoSlots(client: Client): Promise<ClientPhotoSlot[]> {
  if (client.galleryPhotoSlots && client.galleryPhotoSlots.length > 0) {
    const out: ClientPhotoSlot[] = [];
    const seen = new Set<string>();
    for (const slot of client.galleryPhotoSlots) {
      pushUnique(out, seen, slot);
    }
    return out;
  }

  const wellnest = getWellnestDemoPhotoUrls(client.id);
  if (wellnest) {
    const out: ClientPhotoSlot[] = [];
    const seen = new Set<string>();
    pushUnique(out, seen, { id: "front", label: "Front", url: wellnest.front });
    pushUnique(out, seen, { id: "side", label: "Side", url: wellnest.side });
    return out;
  }

  const fallbackFront = getClientFrontPhotoDisplayUrl(client.frontPhoto);

  if (!TABLES_WITH_PHOTOS.includes(client.tableSource as (typeof TABLES_WITH_PHOTOS)[number])) {
    return fallbackFront ? [{ id: "front", label: "Front", url: fallbackFront }] : [];
  }

  try {
    const records = await fetchTableRecords(client.tableSource, {
      filterFormula: `RECORD_ID() = "${client.id}"`,
      fields: [
        "Front Photo",
        "Front Photo (from Form Submissions)",
        "Side Photo",
        "Side Photo (from Form Submissions)",
        "Left Side Photo (from Form Submissions)",
      ],
    });

    const out: ClientPhotoSlot[] = [];
    const seen = new Set<string>();

    if (records.length === 0) {
      return fallbackFront ? [{ id: "front", label: "Front", url: fallbackFront }] : [];
    }

    const fields = records[0].fields as Record<string, unknown>;

    const front = fields["Front Photo"] || fields["Front photo"] || fields["frontPhoto"];
    let frontProcessed: string | null = null;
    if (front && Array.isArray(front) && front.length > 0) {
      frontProcessed = getAttachmentUrl(front[0] as Parameters<typeof getAttachmentUrl>[0]);
    }
    const frontForm = getFirstAttachmentUrl(fields, "Front Photo (from Form Submissions)");

    const side = fields["Side Photo"] || fields["Side photo"] || fields["sidePhoto"];
    let sideProcessed: string | null = null;
    if (side && Array.isArray(side) && side.length > 0) {
      sideProcessed = getAttachmentUrl(side[0] as Parameters<typeof getAttachmentUrl>[0]);
    }
    const sideFormRight = getFirstAttachmentUrl(fields, "Side Photo (from Form Submissions)");
    const sideFormLeft = getFirstAttachmentUrl(fields, "Left Side Photo (from Form Submissions)");

    const freshCdn = { allowExpiringAirtableCdn: true as const };
    const primaryFront = frontProcessed ?? frontForm ?? fallbackFront;
    if (primaryFront) {
      pushUnique(out, seen, { id: "front", label: "Front", url: primaryFront }, freshCdn);
    }
    if (frontProcessed && frontForm && frontProcessed !== frontForm) {
      pushUnique(out, seen, { id: "front-form", label: "Front (intake)", url: frontForm }, freshCdn);
    }
    if (sideProcessed) {
      pushUnique(out, seen, { id: "side", label: "Side", url: sideProcessed }, freshCdn);
    }
    if (sideFormRight) {
      pushUnique(out, seen, { id: "side-form", label: "Side (intake)", url: sideFormRight }, freshCdn);
    }
    if (sideFormLeft) {
      pushUnique(out, seen, { id: "left-form", label: "Left (intake)", url: sideFormLeft }, freshCdn);
    }

    if (out.length === 0 && fallbackFront) {
      return [{ id: "front", label: "Front", url: fallbackFront }];
    }
    return out;
  } catch (e) {
    console.error("loadClientGalleryPhotoSlots:", e);
    return fallbackFront ? [{ id: "front", label: "Front", url: fallbackFront }] : [];
  }
}
