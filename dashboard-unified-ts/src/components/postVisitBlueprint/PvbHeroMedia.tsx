import { useMemo } from "react";
import { AiMirrorCanvas, hasMirrorAnnotationHighlights } from "./AiMirrorCanvas";
import Face3DViewer from "../views/Face3DViewer";
import { mapRecommenderRegionsToMirrorTerms } from "../../utils/pvbRecommenderMirror";
import "./PvbHeroMedia.css";

export interface PvbHeroMediaProps {
  turntableVideoUrl: string | null;
  heroPhotoUrl: string | null;
  recommenderFocusRegions?: string[];
  patientFirstName: string;
}

/**
 * Post-visit blueprint hero: 3D turntable when available, otherwise the static AI mirror photo.
 */
export default function PvbHeroMedia({
  turntableVideoUrl,
  heroPhotoUrl,
  recommenderFocusRegions = [],
  patientFirstName,
}: PvbHeroMediaProps) {
  const highlightTerms = useMemo(
    () => mapRecommenderRegionsToMirrorTerms(recommenderFocusRegions),
    [recommenderFocusRegions],
  );
  const showAnnotations = hasMirrorAnnotationHighlights(highlightTerms);

  if (turntableVideoUrl) {
    return (
      <div className="pvb-hero-mirror pvb-hero-mirror--3d">
        <Face3DViewer
          videoUrl={turntableVideoUrl}
          autoRotate
          showAnnotations={showAnnotations}
          highlightTerms={highlightTerms}
          showHint={false}
          wheelZoomEnabled={false}
        />
        <div className="pvb-hero-gradient" />
      </div>
    );
  }

  if (!heroPhotoUrl) return null;

  return (
    <div className="pvb-hero-mirror">
      <AiMirrorCanvas
        imageUrl={heroPhotoUrl}
        alt={`${patientFirstName}'s facial analysis`}
        highlightTerms={highlightTerms}
        showAnnotations={showAnnotations}
      />
      <div className="pvb-hero-gradient" />
    </div>
  );
}
