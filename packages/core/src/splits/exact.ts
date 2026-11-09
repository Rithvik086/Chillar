import { InvalidSplitAllocationError } from "../errors";
import { Paise, assertSafePaise } from "../money/money";
import { ExactSplitAllocation, ExpenseSplit } from "../expenses/types";
import {
  assertUniqueUserIds,
  validateAllocationTotal,
} from "../expenses/validation";

export function splitByExactAmounts(
  totalAmount: Paise,
  allocations: readonly ExactSplitAllocation[],
): ExpenseSplit[] {
  assertSafePaise(totalAmount, "totalAmount");
  if (allocations.length === 0)
    throw new InvalidSplitAllocationError(
      "at least one exact allocation is required",
    );
  assertUniqueUserIds(
    allocations.map(({ userId }) => userId),
    "participant",
  );
  const result = allocations.map(({ userId, amount }) => {
    assertSafePaise(amount, `share for ${userId}`);
    return { userId, amountOwed: amount };
  });
  validateAllocationTotal(
    totalAmount,
    result.reduce((sum, split) => sum + split.amountOwed, 0),
    "exact allocations",
  );
  return result;
}
