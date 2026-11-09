import {
  InvalidShareWeightsError,
  InvalidSplitAllocationError,
} from "../errors";
import { Paise, assertSafePaise } from "../money/money";
import { ShareSplitAllocation, ExpenseSplit } from "../expenses/types";
import {
  assertUniqueUserIds,
  validateAllocationTotal,
} from "../expenses/validation";

export function splitByShares(
  totalAmount: Paise,
  allocations: readonly ShareSplitAllocation[],
): ExpenseSplit[] {
  assertSafePaise(totalAmount, "totalAmount");
  if (allocations.length === 0)
    throw new InvalidSplitAllocationError(
      "at least one share allocation is required",
    );
  assertUniqueUserIds(
    allocations.map(({ userId }) => userId),
    "participant",
  );
  const totalSharesBigInt = allocations.reduce((sum, allocation) => {
    if (!Number.isSafeInteger(allocation.shares) || allocation.shares <= 0)
      throw new InvalidShareWeightsError(
        `shares for ${allocation.userId} must be a positive safe integer`,
      );
    return sum + BigInt(allocation.shares);
  }, 0n);
  if (totalSharesBigInt > BigInt(Number.MAX_SAFE_INTEGER))
    throw new InvalidShareWeightsError(
      "share weights exceed the safe integer range",
    );
  const result = allocations.map(({ userId, shares }) => {
    const amountOwed = Number(
      (BigInt(totalAmount) * BigInt(shares)) / totalSharesBigInt,
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
    "share allocations",
  );
  return result;
}
