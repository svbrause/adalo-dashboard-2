import type { CSSProperties } from "react";
import regionalFaceFront from "../assets/images/regional-face-front.png";

export type RegionalFacePanView = "front";

export const REGIONAL_FACE_PAN_VIEW: RegionalFacePanView = "front";

export const REGIONAL_FACE_VIEW_IMAGE = regionalFaceFront;

export const REGIONAL_FACE_IMAGE_WIDTH = 524;
export const REGIONAL_FACE_IMAGE_HEIGHT = 667;

const REGIONAL_FACE_FRAME = {
  topCrop: 0.11,
  zoom: 1.26,
  panXPercent: 0,
  originY: 0.36,
};

export const REGIONAL_FACE_VIEWPORT_ASPECT =
  (REGIONAL_FACE_IMAGE_WIDTH * REGIONAL_FACE_FRAME.zoom) /
  (REGIONAL_FACE_IMAGE_HEIGHT * (1 - REGIONAL_FACE_FRAME.topCrop) * REGIONAL_FACE_FRAME.zoom);

export function regionalFaceMediaStyle(): CSSProperties {
  const { topCrop, zoom, panXPercent, originY } = REGIONAL_FACE_FRAME;
  return {
    transform: `translate(${panXPercent}%, ${-topCrop * 100}%) scale(${zoom})`,
    transformOrigin: `50% ${originY * 100}%`,
  };
}
