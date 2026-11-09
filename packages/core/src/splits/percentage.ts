import {
  PercentageTotalMismatchError,
  InvalidSplitAllocationError,
} from "../errors";
import { Paise, assertSafePaise } from "../money/money";
import { PercentageSplitAllocation, ExpenseSplit } from "../expenses/types";
import {
  assertUniqueUserIds,
  validateAllocationTotal,
} from "../expenses/validation";

const PERCENTAGE_SCALE = 100;
function toBasisPoints(value: number | string, userId: string): number {
  if (typeof value === "number" && (!Number.isFinite(value) || value < 0))
    throw new InvalidSplitAllocationError(
      `percentage for ${userId} must be non-negative`,
    );
  if (typeof value !== "number" && typeof value !== "string")
    throw new InvalidSplitAllocationError(
      `percentage for ${userId} must be a decimal value`,
    );
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text))
    throw new InvalidSplitAllocationError(
      `percentage for ${userId} must use decimal notation`,
    );
  const [whole, fraction = ""] = text.split(".");
  const basisPoints =
    BigInt(whole) * BigInt(PERCENTAGE_SCALE) +
    BigInt((fraction + "00").slice(0, 2));
  if (basisPoints > 10000n || basisPoints > BigInt(Number.MAX_SAFE_INTEGER))
    throw new InvalidSplitAllocationError(
      `percentage for ${userId} is outside the allowed range`,
    );
  return Number(basisPoints);
}

/** Percentages use basis points: 0.01% precision, and must total exactly 100.00%. */
export function splitByPercentage(
  totalAmount: Paise,
  allocations: readonly PercentageSplitAllocation[],
): ExpenseSplit[] {
  assertSafePaise(totalAmount, "totalAmount");
  if (allocations.length === 0)
    throw new InvalidSplitAllocationError(
      "at least one percentage allocation is required",
    );
  assertUniqueUserIds(
    allocations.map(({ userId }) => userId),
    "participant",
  );
  const entries = allocations.map(({ userId, percentage }) => ({
    userId,
    basisPoints: toBasisPoints(percentage, userId),
  }));
  if (
    entries.reduce((sum, entry) => sum + BigInt(entry.basisPoints), 0n) !==
    100n * BigInt(PERCENTAGE_SCALE)
  ) {
    throw new PercentageTotalMismatchError(
      "percentages must total exactly 100.00%",
    );
  }
  const result = entries.map(({ userId, basisPoints }) => {
    const amountOwed = Number(
      (BigInt(totalAmount) * BigInt(basisPoints)) / 10000n,
    );
    assertSafePaise(amountOwed, `share for ${userId}`);
    return { userId, amountOwed };
  });
  let remainder =
    totalAmount - result.reduce((sum, split) => sum + split.amountOwed, 0);
  for (const split of result) {
    if (remainder === 0) break;
    split.amountOwed += 1;
    remainder -= 1;
  }
  validateAllocationTotal(
    totalAmount,
    result.reduce((sum, split) => sum + split.amountOwed, 0),
    "percentage allocations",
  );
  return result;
}
