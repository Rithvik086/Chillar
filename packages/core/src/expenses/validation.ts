import {
  DuplicateUserIdError, EmptyParticipantsError, InvalidPayerAllocationError,
  InvalidSplitAllocationError, PayerTotalMismatchError, SplitTotalMismatchError,
} from "../errors";
import { addPaise, assertSafePaise, Paise } from "../money/money";
import { Expense } from "./types";

export function assertUniqueUserIds(ids: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string" || id.trim() === "") throw new DuplicateUserIdError(`${label} IDs must be non-empty strings`);
    if (seen.has(id)) throw new DuplicateUserIdError(`${label} contains duplicate user ID "${id}"`);
    seen.add(id);
  }
}

export function validateExpense(expense: Expense): void {
  if (expense === null || typeof expense !== "object") throw new InvalidSplitAllocationError("expense must be an object");
  if (typeof expense.id !== "string" || expense.id.trim() === "") throw new InvalidSplitAllocationError("expense ID is required");
  if (expense.groupId !== undefined && (typeof expense.groupId !== "string" || expense.groupId.trim() === "")) throw new InvalidSplitAllocationError("group ID must be a non-empty string");
  if (expense.currency !== "INR") throw new InvalidSplitAllocationError("only INR expenses are supported");
  if (expense.status !== undefined && expense.status !== "active" && expense.status !== "voided" && expense.status !== "cancelled") throw new InvalidSplitAllocationError("invalid expense status");
  assertSafePaise(expense.totalAmount, "totalAmount", false);
  if (!Array.isArray(expense.payers)) throw new InvalidPayerAllocationError("payers must be an array");
  if (!Array.isArray(expense.splits)) throw new EmptyParticipantsError("splits must be an array");
  if (expense.payers.length === 0) throw new InvalidPayerAllocationError("an expense must have at least one payer");
  if (expense.splits.length === 0) throw new EmptyParticipantsError("an expense must have at least one participant");
  assertUniqueUserIds(expense.payers.map((payer) => payer.userId), "payer");
  assertUniqueUserIds(expense.splits.map((split) => split.userId), "participant");
  const payerTotal = expense.payers.reduce((sum, payer) => {
    if (typeof payer.userId !== "string") throw new InvalidPayerAllocationError("payer ID must be a string");
    assertSafePaise(payer.amountPaid, `payment by ${payer.userId}`);
    return addPaise(sum, payer.amountPaid, "payer total");
  }, 0);
  if (payerTotal !== expense.totalAmount) throw new PayerTotalMismatchError("payer contributions must equal totalAmount");
  const splitTotal = expense.splits.reduce((sum, split) => {
    if (typeof split.userId !== "string") throw new InvalidSplitAllocationError("participant ID must be a string");
    assertSafePaise(split.amountOwed, `share for ${split.userId}`);
    return addPaise(sum, split.amountOwed, "split total");
  }, 0);
  if (splitTotal !== expense.totalAmount) throw new SplitTotalMismatchError("participant shares must equal totalAmount");
}

export function validateParticipants(ids: readonly string[]): void {
  if (ids.length === 0) throw new EmptyParticipantsError("at least one participant is required");
  assertUniqueUserIds(ids, "participant");
}

export function validateAllocationTotal(total: Paise, allocated: Paise, label: string): void {
  if (allocated !== total) throw new SplitTotalMismatchError(`${label} must total exactly ${total} paise (received ${allocated})`);
}
