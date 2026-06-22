/**
 * In-clinic face scan (MediaPipe capture + intake) served from /clinic-scan/.
 * Replaces external app.ponce.ai Jotform links unless VITE_CLINIC_SCAN_USE_EXTERNAL=true.
 */

import type { Client, Provider } from "../types";
import {
  mapAreasToFormFields,
  mapSkinComplaints,
  parseDateOfBirthForForm,
} from "./formMapping";
import { getJotformUrl } from "./providerHelpers";
import { cleanPhoneNumber, splitName } from "./validation";

/** Explicit index.html — `/clinic-scan/` is swallowed by the Vite/React SPA fallback. */
const CLINIC_SCAN_PATH = "/clinic-scan/index.html";

export interface ClinicScanCompleteDetail {
  recordId: string;
  tableName: string;
  jobId?: string;
  estimatedSeconds?: number;
  clientName?: string;
  apiBase?: string;
  formSubmissionId?: string;
  patientCreated?: boolean;
  patientMatchedBy?: string;
}

type ClinicScanOpener = (url: string) => void;
let clinicScanOpener: ClinicScanOpener | null = null;

/** Dashboard mounts ClinicScanHost to receive scan opens as an in-app modal. */
export function registerClinicScanOpener(opener: ClinicScanOpener): () => void {
  clinicScanOpener = opener;
  return () => {
    if (clinicScanOpener === opener) clinicScanOpener = null;
  };
}

function launchClinicScan(url: string): void {
  if (clinicScanOpener) {
    clinicScanOpener(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function useExternalClinicScanForm(): boolean {
  return import.meta.env.VITE_CLINIC_SCAN_USE_EXTERNAL === "true";
}

export function getClinicScanPath(): string {
  return CLINIC_SCAN_PATH;
}

/** Legacy Jotform / app.ponce.ai URL with client fields pre-filled. */
export function buildLegacyJotformScanUrl(
  client: Client,
  provider: Provider | null,
): string {
  const { first, last } = splitName(client.name);
  const phoneNumber = cleanPhoneNumber(client.phone);
  const { whatAreas, faceRegions } = mapAreasToFormFields(client);
  const dob = parseDateOfBirthForForm(client.dateOfBirth);

  const params: string[] = [];
  if (first) params.push(`name[first]=${encodeURIComponent(first)}`);
  if (last) params.push(`name[last]=${encodeURIComponent(last)}`);
  if (client.email) params.push(`email=${encodeURIComponent(client.email)}`);
  if (phoneNumber)
    params.push(`phoneNumber=${encodeURIComponent(phoneNumber)}`);
  if (dob) {
    params.push(`dateOf[month]=${encodeURIComponent(String(dob.month))}`);
    params.push(`dateOf[day]=${encodeURIComponent(String(dob.day))}`);
    params.push(`dateOf[year]=${encodeURIComponent(String(dob.year))}`);
  }
  if (whatAreas.length > 0)
    params.push(`whatAre137=${encodeURIComponent(whatAreas[0])}`);
  else if (faceRegions.length > 0)
    params.push(`whatAre137=${encodeURIComponent("Face")}`);
  if (faceRegions.length > 0)
    params.push(
      `whichRegions138=${encodeURIComponent(faceRegions.join(","))}`,
    );

  const baseUrl = getJotformUrl(provider);
  return params.length > 0 ? `${baseUrl}?${params.join("&")}` : baseUrl;
}

/** Embedded MediaPipe scan with dashboard client context in query params. */
export function buildClinicScanUrl(
  client: Client,
  provider?: Provider | null,
): string {
  const { first, last } = splitName(client.name);
  const phoneNumber = cleanPhoneNumber(client.phone);
  const { whatAreas, faceRegions } = mapAreasToFormFields(client);
  const skinComplaints = mapSkinComplaints(client);
  const dob = parseDateOfBirthForForm(client.dateOfBirth);

  const params = new URLSearchParams();
  params.set("r", client.id);
  params.set("t", client.tableSource);
  if (first) params.set("firstName", first);
  if (last) params.set("lastName", last);
  if (client.email) params.set("email", client.email);
  if (phoneNumber) params.set("phone", phoneNumber);
  if (dob) {
    const mm = String(dob.month).padStart(2, "0");
    const dd = String(dob.day).padStart(2, "0");
    params.set("dob", `${dob.year}-${mm}-${dd}`);
  }
  if (whatAreas.length > 0) params.set("whatAreas", whatAreas.join(","));
  if (faceRegions.length > 0) params.set("faceRegions", faceRegions.join(","));
  if (skinComplaints.length > 0)
    params.set("skinComplaints", skinComplaints.join(","));
  if (provider?.id) params.set("providerId", provider.id);
  if (provider?.name) params.set("providerName", provider.name);

  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}${CLINIC_SCAN_PATH}?${params.toString()}`;
}

export function buildProviderClinicScanUrl(provider: Provider | null): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams();
  if (provider?.id) params.set("providerId", provider.id);
  if (provider?.name) params.set("providerName", provider.name);
  const qs = params.toString();
  return `${base}${CLINIC_SCAN_PATH}${qs ? `?${qs}` : ""}`;
}

export function openClinicScanForClient(
  client: Client,
  provider: Provider | null,
): void {
  const url = useExternalClinicScanForm()
    ? buildLegacyJotformScanUrl(client, provider)
    : buildClinicScanUrl(client, provider);
  launchClinicScan(url);
}

export function openClinicScanForProvider(provider: Provider | null): void {
  const url = useExternalClinicScanForm()
    ? getJotformUrl(provider)
    : buildProviderClinicScanUrl(provider);
  launchClinicScan(url);
}
