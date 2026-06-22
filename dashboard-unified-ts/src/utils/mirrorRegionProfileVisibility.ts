import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

/** Hide forehead / lower-face overlays only near true profile (0 = front, ~0.5+ = profile). */
export const MIRROR_FOREHEAD_LOWER_FACE_MAX_YAW = 0.52;

/** Below this yaw, show both left- and right-side regions. */
export const MIRROR_BILATERAL_BOTH_SIDES_YAW = 0.3;

/** Hide far-side cheek / fold regions only past this yaw when the head is turned. */
export const MIRROR_BILATERAL_OCCLUSION_YAW = 0.5;

/** Cheek patches are broad, so hide the far-side patch earlier than line/fold regions. */
export const MIRROR_CHEEK_OCCLUSION_YAW = 0.34;

export type FaceTurnDirection = "front" | "left" | "right";

function landmarkPoint(
  landmarks: NormalizedLandmark[],
  index: number,
  width: number,
  height: number,
): { x: number; y: number } | null {
  const lm = landmarks[index];
  return lm ? { x: lm.x * width, y: lm.y * height } : null;
}

/** 0 = frontal, ~0.5+ = strong profile (nose offset vs cheek span). */
export function profileYawAmount(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): number {
  const left = landmarkPoint(landmarks, 234, width, height);
  const right = landmarkPoint(landmarks, 454, width, height);
  const nose = landmarkPoint(landmarks, 1, width, height);
  if (!left || !right || !nose) return 0;
  const faceWidth = Math.max(1, Math.abs(right.x - left.x));
  const centerX = (left.x + right.x) / 2;
  return Math.abs(nose.x - centerX) / faceWidth;
}

export function faceTurnDirection(
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): FaceTurnDirection {
  const yaw = profileYawAmount(landmarks, width, height);
  if (yaw < 0.1) return "front";
  const left = landmarkPoint(landmarks, 234, width, height);
  const right = landmarkPoint(landmarks, 454, width, height);
  const nose = landmarkPoint(landmarks, 1, width, height);
  if (!left || !right || !nose) return "front";
  const centerX = (left.x + right.x) / 2;
  const offset = (nose.x - centerX) / Math.max(1, Math.abs(right.x - left.x));
  if (Math.abs(offset) < 0.06) return "front";
  return offset > 0 ? "right" : "left";
}

function isLeftSideMirrorRegion(regionId: string): boolean {
  return regionId.includes("Left");
}

function isRightSideMirrorRegion(regionId: string): boolean {
  return regionId.includes("Right");
}

function isCheekMirrorRegion(regionId: string): boolean {
  return regionId === "rLeftCheek" || regionId === "rRightCheek";
}

/** Whether a volume/structure mirror region should render at the current head pose. */
export function mirrorRegionVisibleAtHeadPose(
  regionId: string,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): boolean {
  const yaw = profileYawAmount(landmarks, width, height);

  if (
    (regionId === "rForehead" || regionId === "rLowerFace") &&
    yaw > MIRROR_FOREHEAD_LOWER_FACE_MAX_YAW
  ) {
    return false;
  }

  if (yaw <= MIRROR_BILATERAL_BOTH_SIDES_YAW) return true;

  const turn = faceTurnDirection(landmarks, width, height);
  const occlusionYaw = isCheekMirrorRegion(regionId)
    ? MIRROR_CHEEK_OCCLUSION_YAW
    : MIRROR_BILATERAL_OCCLUSION_YAW;
  if (turn === "front" || yaw <= occlusionYaw) return true;

  if (isLeftSideMirrorRegion(regionId) && turn === "left") return false;
  if (isRightSideMirrorRegion(regionId) && turn === "right") return false;

  return true;
}
