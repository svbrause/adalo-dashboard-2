import type { AnnotateStroke } from "../components/aura/AnnotateDrawing";

export type SavedPatientAnnotation = {
  id: string;
  clientId: string;
  createdAt: string;
  label: string;
  viewContext: string;
  strokes: AnnotateStroke[];
  /** Source face still used when saving (for reload / re-export). */
  faceImageUrl?: string;
  /** JPEG composite of face + ink. */
  compositeDataUrl?: string;
};

const STORAGE_KEY = "ponce-patient-annotations-v1";

function readAll(): SavedPatientAnnotation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidRecord);
  } catch {
    return [];
  }
}

function writeAll(records: SavedPatientAnnotation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* quota */
  }
}

function isValidRecord(v: unknown): v is SavedPatientAnnotation {
  if (!v || typeof v !== "object") return false;
  const r = v as SavedPatientAnnotation;
  return (
    typeof r.id === "string" &&
    typeof r.clientId === "string" &&
    typeof r.createdAt === "string" &&
    typeof r.label === "string" &&
    Array.isArray(r.strokes)
  );
}

export function listPatientAnnotations(clientId: string): SavedPatientAnnotation[] {
  return readAll()
    .filter((r) => r.clientId === clientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function savePatientAnnotation(input: {
  clientId: string;
  label: string;
  viewContext: string;
  strokes: AnnotateStroke[];
  faceImageUrl?: string;
  compositeDataUrl?: string;
}): SavedPatientAnnotation {
  const record: SavedPatientAnnotation = {
    id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    clientId: input.clientId,
    createdAt: new Date().toISOString(),
    label: input.label.trim() || "Annotation",
    viewContext: input.viewContext,
    strokes: input.strokes,
    faceImageUrl: input.faceImageUrl,
    compositeDataUrl: input.compositeDataUrl,
  };
  const all = readAll();
  all.push(record);
  writeAll(all);
  return record;
}

export function deletePatientAnnotation(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id));
}

export function getPatientAnnotation(id: string): SavedPatientAnnotation | undefined {
  return readAll().find((r) => r.id === id);
}
