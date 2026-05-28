import {
  ADDITIONAL_AI_MIRROR_REGIONS,
  AI_MIRROR_REGIONS,
} from "../postVisitBlueprint/aiMirrorRegions";
import "./FaceMirrorRegionsPicker.css";

const ANNOTATION_REGION_LABELS: Record<string, string> = {
  rForehead: "Forehead",
  rLeftEye: "Left eye",
  rRightEye: "Right eye",
  rNose: "Nose",
  rLeftCheek: "Left cheek",
  rRightCheek: "Right cheek",
  rLips: "Lips",
  rChin: "Chin",
  rLeftUnderEye: "Left under eye",
  rRightUnderEye: "Right under eye",
  rLeftNasolabialFold: "Left nasolabial",
  rRightNasolabialFold: "Right nasolabial",
  rLeftMarionetteLine: "Left marionette",
  rRightMarionetteLine: "Right marionette",
  rLowerFace: "Lower face",
};

const MIRROR_ANNOTATION_REGIONS = [
  ...AI_MIRROR_REGIONS,
  ...ADDITIONAL_AI_MIRROR_REGIONS,
];

export const ALL_MIRROR_ANNOTATION_REGION_IDS = MIRROR_ANNOTATION_REGIONS.map(
  (region) => region.id,
);

function HighlightRegionsEyeIcon({
  size = 15,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export type FaceMirrorRegionsPickerProps = {
  manualHighlightedRegionIds: string[];
  onSetManualHighlightedRegionIds: (ids: string[]) => void;
  onToggleAnnotationRegionHighlight: (regionId: string) => void;
  /** Compact pill on the face viewport (default). */
  variant?: "overlay" | "aura-rail";
};

export default function FaceMirrorRegionsPicker({
  manualHighlightedRegionIds,
  onSetManualHighlightedRegionIds,
  onToggleAnnotationRegionHighlight,
  variant = "overlay",
}: FaceMirrorRegionsPickerProps) {
  const hasSelection = manualHighlightedRegionIds.length > 0;

  return (
    <details
      className={[
        "fmp-annotation-regions",
        `fmp-annotation-regions--${variant}`,
        variant === "aura-rail" && hasSelection
          ? "fmp-annotation-regions--active"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <summary title="Highlight regions" aria-label="Highlight regions">
        {variant === "overlay" ? (
          "Regions"
        ) : (
          <HighlightRegionsEyeIcon className="fmp-regions-icon" />
        )}
      </summary>
      <div className="fmp-annotation-regions__panel">
        <div className="fmp-annotation-regions__actions">
          <button
            type="button"
            onClick={() =>
              onSetManualHighlightedRegionIds(ALL_MIRROR_ANNOTATION_REGION_IDS)
            }
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onSetManualHighlightedRegionIds([])}
          >
            None
          </button>
        </div>
        <div className="fmp-annotation-regions__grid">
          {MIRROR_ANNOTATION_REGIONS.map((region) => (
            <label key={region.id} className="fmp-annotation-regions__item">
              <input
                type="checkbox"
                checked={manualHighlightedRegionIds.includes(region.id)}
                onChange={() => onToggleAnnotationRegionHighlight(region.id)}
              />
              <span>{ANNOTATION_REGION_LABELS[region.id] ?? region.id}</span>
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}
