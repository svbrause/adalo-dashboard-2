import { QUANTITY_UNIT_OPTIONS } from "./constants";
import { getQuantityContext } from "./utils";

export function DiscussedTreatmentsQuantityFormRow({
  treatment,
  product,
  quantity,
  quantityUnit,
  onPatch,
  labelMode,
}: {
  treatment: string;
  product: string;
  quantity: string;
  quantityUnit: string;
  onPatch: (patch: { quantity?: string; quantityUnit?: string }) => void;
  labelMode: "optional" | "affectsQuote";
}) {
  const qtyCtx = getQuantityContext(treatment, product || undefined);
  const displayUnit = quantityUnit || qtyCtx.unitLabel;
  const label =
    labelMode === "affectsQuote"
      ? `${displayUnit} (affects quote)`
      : `${displayUnit} (optional)`;

  return (
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
              onClick={() =>
                onPatch({ quantity: quantity === q ? "" : q })
              }
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
  );
}
