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

export type FaceMirrorHighlightOption = {
  id: string;
  label: string;
  regionIds: string[];
};

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
      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export type FaceMirrorRegionsPickerProps = {
  manualHighlightedRegionIds: string[];
  /** Regions currently visible on the face, including automatic tab defaults. */
  visibleHighlightedRegionIds?: string[];
  /** Regions highlighted automatically by the active Aura tab. */
  defaultHighlightedRegionIds?: string[];
  /** Optional issue-based options to show instead of generic anatomy regions. */
  highlightOptions?: FaceMirrorHighlightOption[];
  onSetManualHighlightedRegionIds: (ids: string[]) => void;
  /** Compact pill on the face viewport (default) or unified top toolbar. */
  variant?: "overlay" | "aura-rail" | "toolbar";
};

export default function FaceMirrorRegionsPicker({
  manualHighlightedRegionIds,
  visibleHighlightedRegionIds,
  defaultHighlightedRegionIds = [],
  highlightOptions,
  onSetManualHighlightedRegionIds,
  variant = "overlay",
}: FaceMirrorRegionsPickerProps) {
  const activeRegionIds = visibleHighlightedRegionIds ?? manualHighlightedRegionIds;
  const activeRegionSet = new Set(activeRegionIds);
  const defaultRegionSet = new Set(defaultHighlightedRegionIds);
  const hasSelection = activeRegionIds.length > 0;
  const hasCustomOptions = highlightOptions !== undefined;
  const issueOptions = highlightOptions?.filter((option) => option.label.trim()) ?? [];
  const usesIssueOptions = hasCustomOptions;
  const selectableOptionRegionIds = usesIssueOptions
    ? issueOptions.flatMap((option) => option.regionIds)
    : ALL_MIRROR_ANNOTATION_REGION_IDS;

  const setVisibleRegions = (ids: string[]) => {
    const validIds = ids.filter((id) =>
      ALL_MIRROR_ANNOTATION_REGION_IDS.includes(id),
    );
    onSetManualHighlightedRegionIds([...new Set(validIds)]);
  };

  const toggleRegions = (regionIds: string[]) => {
    if (regionIds.length === 0) return;
    const selected = regionIds.every((id) => activeRegionSet.has(id));
    const optionRegionSet = new Set(regionIds);
    const next = selected
      ? activeRegionIds.filter((id) => !optionRegionSet.has(id))
      : [...activeRegionIds, ...regionIds];
    setVisibleRegions(next);
  };

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
      <summary title="Face highlights" aria-label="Face highlights">
        {variant === "overlay" ? (
          "Highlights"
        ) : (
          <HighlightRegionsEyeIcon className="fmp-regions-icon" />
        )}
      </summary>
      <div className="fmp-annotation-regions__panel">
        <div className="fmp-annotation-regions__header">
          <p className="fmp-annotation-regions__eyebrow">Face highlights</p>
          <h3 className="fmp-annotation-regions__title">
            {usesIssueOptions ? "Highlighted findings" : "Highlighted regions"}
          </h3>
        </div>
        <div className="fmp-annotation-regions__visibility">
          <span className="fmp-annotation-regions__visibility-label">
            Marker visibility
          </span>
          <div className="fmp-annotation-regions__actions">
            <button
              type="button"
              className="fmp-annotation-regions__action fmp-annotation-regions__action--show"
              disabled={selectableOptionRegionIds.length === 0}
              onClick={() => setVisibleRegions(selectableOptionRegionIds)}
            >
              Show all
            </button>
            <button
              type="button"
              className="fmp-annotation-regions__action fmp-annotation-regions__action--hide"
              onClick={() => setVisibleRegions([])}
            >
              Hide all
            </button>
          </div>
        </div>
        <p className="fmp-annotation-regions__options-label">
          {usesIssueOptions ? "Findings shown in panel" : "Face regions"}
        </p>
        {usesIssueOptions && issueOptions.length === 0 ? (
          <p className="fmp-annotation-regions__empty">No findings in this view</p>
        ) : (
          <div
            className={`fmp-annotation-regions__grid${
              usesIssueOptions ? " fmp-annotation-regions__grid--issues" : ""
            }`}
          >
            {(usesIssueOptions
              ? issueOptions
              : MIRROR_ANNOTATION_REGIONS.map((region) => ({
                  id: region.id,
                  label: ANNOTATION_REGION_LABELS[region.id] ?? region.id,
                  regionIds: [region.id],
                }))
            ).map((option) => {
              const selected =
                option.regionIds.length > 0 &&
                option.regionIds.every((id) => activeRegionSet.has(id));
              const isDefault =
                !usesIssueOptions &&
                option.regionIds.some((id) => defaultRegionSet.has(id));
              const disabled = option.regionIds.length === 0;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={[
                    "fmp-annotation-regions__item",
                    selected ? "fmp-annotation-regions__item--selected" : "",
                    isDefault ? "fmp-annotation-regions__item--default" : "",
                    disabled ? "fmp-annotation-regions__item--disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() => toggleRegions(option.regionIds)}
                >
                  <span>{option.label}</span>
                  {isDefault ? (
                    <span className="fmp-annotation-regions__default-badge">
                      Default
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}
