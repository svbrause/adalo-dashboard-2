import type { ClientPhotoSlot } from "../types";

function isExcludedScanPhotoSlot(slot: ClientPhotoSlot): boolean {
  const blob = `${slot.id} ${slot.label ?? ""}`.toLowerCase();
  return (
    blob.includes("consent") ||
    blob.includes("document") ||
    blob.includes("pdf")
  );
}

export function mapSlotsToModalPhotos(
  slots: ClientPhotoSlot[],
): Record<string, string> {
  const photos: Record<string, string> = {};

  // Keep original intake/form photos when the user selects them; only drop
  // non-photo documents that Modal cannot use as scan inputs.
  const photoSlots = slots.filter(
    (slot) => slot.url && !isExcludedScanPhotoSlot(slot),
  );

  if (photoSlots.length === 0) return {};

  const frontSlot =
    photoSlots.find((slot) => {
      const blob = `${slot.id} ${slot.label ?? ""}`.toLowerCase();
      return slot.id === "front" || blob.includes("front");
    }) ?? photoSlots[0];

  photos.front = frontSlot.url;

  const keyCount: Record<string, number> = {};

  for (const slot of photoSlots) {
    if (slot.url === frontSlot.url) continue;
    const blob = `${slot.id} ${slot.label ?? ""}`.toLowerCase();

    let base: string;
    if (blob.includes("left") && blob.includes("90")) base = "left90";
    else if (blob.includes("right") && blob.includes("90")) base = "right90";
    else if (blob.includes("left") && blob.includes("45")) base = "left45";
    else if (blob.includes("right") && blob.includes("45")) base = "right45";
    else if (blob.includes("left")) base = "left90";
    else if (blob.includes("right")) base = "right90";
    else if (blob.includes("side")) base = "side";
    else base = "extra";

    const n = keyCount[base] ?? 0;
    photos[n === 0 ? base : `${base}_${n}`] = slot.url;
    keyCount[base] = n + 1;
  }

  return photos;
}
