import { Paise, addPaise, assertSafePaise } from "./money";
import { InvalidShareWeightsError, InvalidSplitAllocationError } from "../errors";
import { assertUniqueUserIds, validateAllocationTotal } from "../expenses/validation";

export interface RemainderAllocation {
  userId: string;
  amount: Paise;
}

export function allocateProportionally(
  total: Paise,
  entries: readonly { userId: string; weight: number }[],
): RemainderAllocation[] {
  assertSafePaise(total, "total");
  if (entries.length === 0) throw new InvalidSplitAllocationError("at least one proportional allocation is required");
  assertUniqueUserIds(entries.map(({ userId }) => userId), "participant");
  const weightTotal = entries.reduce((sum, entry) => {
    if (!Number.isSafeInteger(entry.weight) || entry.weight <= 0) {
      throw new InvalidShareWeightsError("weights must be positive safe integers");
    }
    return sum + BigInt(entry.weight);
  }, 0n);
  if (weightTotal > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new InvalidShareWeightsError("share weights exceed the safe integer range");
  }
  const allocations = entries.map(({ userId, weight }) => ({
    userId,
    amount: Number((BigInt(total) * BigInt(weight)) / weightTotal),
  }));
  const allocated = allocations.reduce((sum, entry) => addPaise(sum, entry.amount, "allocation total"), 0);
  let remainder = total - allocated;
  for (let index = 0; index < allocations.length && remainder > 0; index += 1) {
    allocations[index].amount += 1;
    remainder -= 1;
  }
  validateAllocationTotal(total, allocations.reduce((sum, entry) => sum + entry.amount, 0), "proportional allocations");
  return allocations;
}
