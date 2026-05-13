import { QUANTITY_UNIT_OPTIONS } from "./constants";
import {
  getQuantityContext,
  shouldStoreTreatmentInterval,
} from "./utils";

export type DiscussedTreatmentsQuantityPatch = {
  quantity?: string;
  quantityUnit?: string;
  bioTreatmentSessions?: string;
  treatmentInterval?: string;
};

export function DiscussedTreatmentsQuantityFormRow({
  treatment,
  product,
  providerCode,
  quantity,
  bioTreatmentSessions,
  treatmentInterval,
  quantityUnit,
  onPatch,
  labelMode,
}: {
  treatment: string;
  product: string;
  providerCode?: string;
  quantity: string;
  bioTreatmentSessions?: string;
  treatmentInterval?: string;
  quantityUnit: string;
  onPatch: (patch: DiscussedTreatmentsQuantityPatch) => void;
  labelMode: "optional" | "affectsQuote";
}) {
  const qtyCtx = getQuantityContext(
    treatment,
    product || undefined,
    providerCode,
  );
  const displayUnit = quantityUnit || qtyCtx.unitLabel;
  const primaryField = qtyCtx.primaryDiscussedField ?? "quantity";
  const primaryValue =
    primaryField === "bioTreatmentSessions"
      ? (bioTreatmentSessions ?? "")
      : quantity;
  const sessionsValue =
    (bioTreatmentSessions ?? "").trim() ||
    qtyCtx.sculptraSessions?.defaultSessions ||
    "";

  const affectSuffix =
    labelMode === "affectsQuote" ? " (affects quote)" : " (optional)";

  const renderChipRow = (
    label: string,
    value: string,
    options: readonly string[],
    onPick: (next: string) => void,
  ) => (
    <div className="discussed-treatments-prefill-row">
      <span className="discussed-treatments-prefill-label">{label}</span>
      <div className="discussed-treatments-chip-row">
        {options.map((q) => (
          <button
            key={q}
            type="button"
            className={`discussed-treatments-prefill-chip ${
              value === q ? "selected" : ""
            }`}
            onClick={() => onPick(value === q ? "" : q)}
          >
            {q}
          </button>
        ))}
        <span className="discussed-treatments-quantity-other-wrap">
          <input
            type="number"
            min={1}
            max={999}
            placeholder="Other"
            value={value && !options.includes(value) ? value : ""}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              onPick(v);
            }}
            className="discussed-treatments-quantity-other-input"
            aria-label={`${label} (other)`}
          />
        </span>
      </div>
    </div>
  );

  const renderPlainChipRow = (
    label: string,
    value: string,
    options: readonly string[],
    onPick: (next: string) => void,
  ) => (
    <div className="discussed-treatments-prefill-row">
      <span className="discussed-treatments-prefill-label">{label}</span>
      <div className="discussed-treatments-chip-row">
        {options.map((q) => (
          <button
            key={q}
            type="button"
            className={`discussed-treatments-prefill-chip ${
              value === q ? "selected" : ""
            }`}
            onClick={() => onPick(value === q ? "" : q)}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );

  const intervalSessionsValue =
    qtyCtx.sculptraSessions ? sessionsValue : primaryValue;
  const showIntervalRow = shouldStoreTreatmentInterval(
    qtyCtx,
    intervalSessionsValue,
  );
  const intervalValue =
    treatmentInterval?.trim() || qtyCtx.intervalOptions?.[0] || "";
  const intervalRow = showIntervalRow
    ? renderPlainChipRow(
        "Interval between treatments",
        intervalValue,
        qtyCtx.intervalOptions ?? [],
        (next) => onPatch({ treatmentInterval: next }),
      )
    : null;

  if (qtyCtx.sculptraSessions) {
    const sOpts = qtyCtx.sculptraSessions.options;
    const sLabel = `${qtyCtx.sculptraSessions.unitLabel}${affectSuffix}`;
    return (
      <div className="discussed-treatments-prefill-rows discussed-treatments-sculptra-qty-rows">
        {renderChipRow(
          `${qtyCtx.unitLabel}${affectSuffix}`,
          primaryValue,
          qtyCtx.options,
          (next) => onPatch({ quantity: next }),
        )}
        {renderChipRow(sLabel, sessionsValue, sOpts, (next) =>
          onPatch({ bioTreatmentSessions: next }),
        )}
        {intervalRow}
      </div>
    );
  }

  if (primaryField === "bioTreatmentSessions") {
    return (
      <div className="discussed-treatments-prefill-rows">
        {renderChipRow(
          `${qtyCtx.unitLabel}${affectSuffix}`,
          primaryValue,
          qtyCtx.options,
          (next) => onPatch({ bioTreatmentSessions: next }),
        )}
        {intervalRow}
      </div>
    );
  }

  const label =
    labelMode === "affectsQuote"
      ? `${displayUnit} (affects quote)`
      : `${displayUnit} (optional)`;

  return (
    <>
    <div className="discussed-treatments-prefill-row">
      <span className="discussed-treatments-prefill-label">{label}</span>
      <select
        className="discussed-treatments-quantity-unit-select"
        value={displayUnit}
        onChange={(e) => onPatch({ quantityUnit: e.target.value })}
        aria-label="Quantity unit"
      >
        {QUANTITY_UNIT_OPTIONS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      {qtyCtx.quantityControl === "text" ? (
        <input
          type="text"
          inputMode="numeric"
          className="discussed-treatments-quantity-other-input"
          style={{ width: "100%", maxWidth: 120 }}
          placeholder={qtyCtx.defaultQuantity}
          value={quantity ?? ""}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            onPatch({ quantity: v });
          }}
          aria-label={displayUnit}
        />
      ) : (
        <div className="discussed-treatments-chip-row">
          {qtyCtx.options.map((q) => (
            <button
              key={q}
              type="button"
              className={`discussed-treatments-prefill-chip ${
                quantity === q ? "selected" : ""
              }`}
              onClick={() => onPatch({ quantity: quantity === q ? "" : q })}
            >
              {q}
            </button>
          ))}
          <span className="discussed-treatments-quantity-other-wrap">
            <input
              type="number"
              min={1}
              max={999}
              placeholder="Other"
              value={
                quantity && !qtyCtx.options.includes(quantity) ? quantity : ""
              }
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                onPatch({ quantity: v });
              }}
              className="discussed-treatments-quantity-other-input"
              aria-label={`${displayUnit} (other)`}
            />
          </span>
        </div>
      )}
    </div>
    {intervalRow}
    </>
  );
}
