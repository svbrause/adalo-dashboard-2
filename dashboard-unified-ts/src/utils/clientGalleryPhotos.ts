import type { Client, ClientPhotoSlot } from "../types";
import { fetchTableRecords } from "../services/api";
import { getWellnestDemoPhotoUrls } from "../debug/wellnestDemoPhotos";
import {
  getClientFrontPhotoDisplayUrl,
  sanitizePhotoDisplayUrl,
} from "./photoLoading";
import {
  resolvePatientAuraManifest,
  type PatientAuraAssetManifest,
} from "./patientAuraAssets";

const TABLES_WITH_PHOTOS = ["Patients", "Web Popup Leads"] as const;

const PATIENT_PHOTO_FIELDS = [
  "Preferred Front Photo",
  "Preferred Side Photo",
  "Front Photo (from Patient Photos)",
  "Right Side Photo (from Patient Photos)",
  "Left Side Photo (from Patient Photos)",
  "Right 45º Photo (from Patient Photos)",
  "Left 45º Photo (from Patient Photos)",
] as const;

const PATIENT_BASE_PHOTO_FIELDS = [
  "Front Photo",
  "Front Photo (from Form Submissions)",
  "Side Photo",
  "Side Photo (from Form Submissions)",
  "Left Side Photo (from Form Submissions)",
] as const;

const AURA_ANGLE_SLOT_META = [
  { angle: "front", id: "front", label: "Front" },
  { angle: "three-quarter-left", id: "left45", label: "Left 45°" },
  { angle: "three-quarter-right", id: "right45", label: "Right 45°" },
  { angle: "profile-left", id: "left90", label: "Left profile" },
  { angle: "profile-right", id: "right90", label: "Right profile" },
] as const;

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

function getFirstAvailableAttachmentUrl(
  fields: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const url = getFirstAttachmentUrl(fields, key);
    if (url) return url;
  }
  return null;
}

function manifestProcessedUrl(
  manifest: PatientAuraAssetManifest,
  angle: keyof PatientAuraAssetManifest["angles"],
): string | null {
  const asset = manifest.angles?.[angle];
  if (!asset) return null;
  return asset.srcCutout || (asset.src && asset.src !== asset.srcOriginal ? asset.src : null);
}

async function loadAuraProcessedPhotoSlots(
  client: Client,
): Promise<ClientPhotoSlot[]> {
  if (
    client.tableSource !== "Patients" ||
    (!client.auraManifestUrl?.trim() && !client.auraGcsPrefix?.trim())
  ) {
    return [];
  }

  const manifest = await resolvePatientAuraManifest({
    clientName: client.name,
    turntableVideoUrl: client.turntableVideoUrl,
    auraManifestUrl: client.auraManifestUrl,
    auraGcsPrefix: client.auraGcsPrefix,
    probeWhenNoTurntable: true,
  });
  if (!manifest?.angles) return [];

  const out: ClientPhotoSlot[] = [];
  for (const meta of AURA_ANGLE_SLOT_META) {
    const url = manifestProcessedUrl(manifest, meta.angle);
    if (!url) continue;
    out.push({ id: meta.id, label: meta.label, url });
  }
  return out;
}

function escapeAirtableStringLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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

async function loadAnalysisPhotoSlots(client: Client): Promise<ClientPhotoSlot[]> {
  if (client.tableSource !== "Patients") return [];

  try {
    const records = await fetchTableRecords("Analyses", {
      filterFormula: `FIND("${escapeAirtableStringLiteral(client.id)}", ARRAYJOIN({RECORD ID (from Patients)})) > 0`,
      fields: ["Front Image", "Side Image"],
    });

    const sorted = [...records].sort((a, b) => {
      const aTime = a.createdTime ? Date.parse(a.createdTime) : 0;
      const bTime = b.createdTime ? Date.parse(b.createdTime) : 0;
      return bTime - aTime;
    });

    const out: ClientPhotoSlot[] = [];
    const seen = new Set<string>();
    const freshCdn = { allowExpiringAirtableCdn: true as const };

    for (const record of sorted) {
      const fields = record.fields as Record<string, unknown>;
      const front = getFirstAttachmentUrl(fields, "Front Image");
      const side = getFirstAttachmentUrl(fields, "Side Image");
      if (front) pushUnique(out, seen, { id: "front", label: "Front", url: front }, freshCdn);
      if (side) pushUnique(out, seen, { id: "side", label: "Side", url: side }, freshCdn);
      if (out.length > 0) break;
    }

    return out;
  } catch (e) {
    console.warn("loadClientGalleryPhotoSlots: analysis images unavailable", e);
    return [];
  }
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
    const requestedFields =
      client.tableSource === "Patients"
        ? [...PATIENT_BASE_PHOTO_FIELDS, ...PATIENT_PHOTO_FIELDS]
        : [...PATIENT_BASE_PHOTO_FIELDS];
    const records = await fetchTableRecords(client.tableSource, {
      filterFormula: `RECORD_ID() = "${client.id}"`,
      fields: requestedFields,
    });

    const out: ClientPhotoSlot[] = [];
    const seen = new Set<string>();
    const freshCdn = { allowExpiringAirtableCdn: true as const };

    for (const slot of await loadAuraProcessedPhotoSlots(client)) {
      pushUnique(out, seen, slot);
    }

    for (const slot of await loadAnalysisPhotoSlots(client)) {
      pushUnique(out, seen, slot, freshCdn);
    }

    if (records.length === 0) {
      if (out.length > 0) return out;
      return fallbackFront ? [{ id: "front", label: "Front", url: fallbackFront }] : [];
    }

    const fields = records[0].fields as Record<string, unknown>;

    const patientPhotosFront = getFirstAvailableAttachmentUrl(fields, [
      "Preferred Front Photo",
      "Front Photo (from Patient Photos)",
    ]);
    const patientPhotosPreferredSide = getFirstAvailableAttachmentUrl(fields, [
      "Preferred Side Photo",
    ]);
    const patientPhotosRightSide = getFirstAttachmentUrl(
      fields,
      "Right Side Photo (from Patient Photos)",
    );
    const patientPhotosLeftSide = getFirstAttachmentUrl(
      fields,
      "Left Side Photo (from Patient Photos)",
    );
    const patientPhotosRight45 = getFirstAttachmentUrl(
      fields,
      "Right 45º Photo (from Patient Photos)",
    );
    const patientPhotosLeft45 = getFirstAttachmentUrl(
      fields,
      "Left 45º Photo (from Patient Photos)",
    );

    if (patientPhotosFront) {
      pushUnique(out, seen, { id: "front", label: "Front", url: patientPhotosFront }, freshCdn);
    }
    if (patientPhotosLeft45) {
      pushUnique(out, seen, { id: "left45", label: "Left 45°", url: patientPhotosLeft45 }, freshCdn);
    }
    if (patientPhotosRight45) {
      pushUnique(out, seen, { id: "right45", label: "Right 45°", url: patientPhotosRight45 }, freshCdn);
    }
    if (patientPhotosLeftSide) {
      pushUnique(out, seen, { id: "left90", label: "Left profile", url: patientPhotosLeftSide }, freshCdn);
    }
    if (patientPhotosRightSide) {
      pushUnique(out, seen, { id: "right90", label: "Right profile", url: patientPhotosRightSide }, freshCdn);
    }
    if (patientPhotosPreferredSide) {
      pushUnique(out, seen, { id: "side", label: "Side", url: patientPhotosPreferredSide }, freshCdn);
    }

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
