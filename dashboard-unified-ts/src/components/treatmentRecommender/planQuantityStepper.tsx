import "./planQuantityStepper.css";

export function planQuantityNumericOptions(options: readonly string[]): number[] {
  const nums = options
    .map((o) => parseInt(String(o).trim(), 10))
    .filter((n) => !Number.isNaN(n) && n > 0);
  return [...new Set(nums)].sort((a, b) => a - b);
}

export function snapPlanQuantityToOptions(
  raw: string,
  options: readonly string[],
  fallback: string,
): string {
  const nums = planQuantityNumericOptions(options);
  if (nums.length === 0) return fallback;
  const trimmed = String(raw).trim();
  if (!trimmed) return fallback;
  const n = parseInt(trimmed.replace(/\D/g, ""), 10);
  if (Number.isNaN(n)) return fallback;
  if (nums.includes(n)) return String(n);
  const closest = nums.reduce((prev, curr) =>
    Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev,
  );
  return String(closest);
}

export function adjustPlanQuantityDiscrete(
  current: string,
  options: readonly string[],
  direction: "up" | "down",
  fallback: string,
): string {
  const nums = planQuantityNumericOptions(options);
  if (nums.length === 0) return fallback;
  const trimmed = String(current).trim();
  const q = parseInt(trimmed, 10);
  if (Number.isNaN(q) || !trimmed) {
    if (direction === "up") {
      const fb = parseInt(fallback, 10);
      if (!Number.isNaN(fb) && nums.includes(fb)) {
        const i = nums.indexOf(fb);
        return String(nums[Math.min(i + 1, nums.length - 1)]);
      }
      return nums.length > 1 ? String(nums[1]) : String(nums[0]);
    }
    return String(nums[0]);
  }
  const idx = nums.indexOf(q);
  if (direction === "up") {
    if (idx === -1) {
      const next = nums.find((x) => x > q);
      return String(next ?? nums[nums.length - 1]);
    }
    if (idx >= nums.length - 1) return String(nums[nums.length - 1]);
    return String(nums[idx + 1]);
  }
  if (idx === -1) {
    const prev = [...nums].reverse().find((x) => x < q);
    return String(prev ?? nums[0]);
  }
  if (idx <= 0) return String(nums[0]);
  return String(nums[idx - 1]);
}

function quantityAtMin(current: string, options: readonly string[]): boolean {
  const nums = planQuantityNumericOptions(options);
  if (nums.length === 0) return true;
  const q = parseInt(String(current).trim(), 10);
  if (Number.isNaN(q)) return false;
  return q <= nums[0];
}

function quantityAtMax(current: string, options: readonly string[]): boolean {
  const nums = planQuantityNumericOptions(options);
  if (nums.length === 0) return true;
  const q = parseInt(String(current).trim(), 10);
  if (Number.isNaN(q)) return false;
  return q >= nums[nums.length - 1];
}

type PlanQuantityStepperInputProps = {
  unitLabel: string;
  quantity: string;
  options: readonly string[];
  defaultQuantity: string;
  inputId: string;
  onQuantityChange: (next: string) => void;
};

/** Discrete quantity: type a number (snaps on blur) or use − / + to move through allowed values. */
export function PlanQuantityStepperInput({
  unitLabel,
  quantity,
  options,
  defaultQuantity,
  inputId,
  onQuantityChange,
}: PlanQuantityStepperInputProps) {
  const nums = planQuantityNumericOptions(options);
  const singleOption = nums.length <= 1;
  const atMin = quantityAtMin(quantity, options);
  const atMax = quantityAtMax(quantity, options);

  return (
    <div className="plan-quantity-stepper">
      <button
        type="button"
        className="plan-quantity-stepper__btn"
        aria-label={`Decrease ${unitLabel}`}
        disabled={
          singleOption || (atMin && String(quantity).trim() !== "")
        }
        onClick={() =>
          onQuantityChange(
            adjustPlanQuantityDiscrete(
              quantity,
              options,
              "down",
              defaultQuantity,
            ),
          )
        }
      >
        −
      </button>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        className="plan-quantity-stepper__input"
        aria-label={unitLabel}
        placeholder={defaultQuantity}
        value={quantity}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "");
          onQuantityChange(v);
        }}
        onBlur={() =>
          onQuantityChange(
            snapPlanQuantityToOptions(quantity, options, defaultQuantity),
          )
        }
      />
      <button
        type="button"
        className="plan-quantity-stepper__btn"
        aria-label={`Increase ${unitLabel}`}
        disabled={singleOption || atMax}
        onClick={() =>
          onQuantityChange(
            adjustPlanQuantityDiscrete(
              quantity,
              options,
              "up",
              defaultQuantity,
            ),
          )
        }
      >
        +
      </button>
    </div>
  );
}
