import {
  assertSafePaise,
  assertUniqueUserIds,
  validateExpense,
  type Expense,
} from "@chillar/core";
import type { ExpenseAllocationInput, ExpenseSplitType } from "@/services/expenses/expense.types";

export const MAX_EXPENSE_ALLOCATIONS = 20;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SPLIT_TYPES: readonly ExpenseSplitType[] = ["equal", "exact", "percentage", "shares"];

export function assertValidUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a valid UUID`);
  }
}

export function assertValidSplitType(value: string): asserts value is ExpenseSplitType {
  if (!SPLIT_TYPES.includes(value as ExpenseSplitType)) {
    throw new TypeError(`split type must be one of: ${SPLIT_TYPES.join(", ")}`);
  }
}

export function validateExpenseAllocations(
  totalAmount: number,
  payers: readonly ExpenseAllocationInput[],
  splits: readonly ExpenseAllocationInput[],
): void {
  assertSafePaise(totalAmount, "totalAmount", false);
  if (payers.length === 0 || payers.length > MAX_EXPENSE_ALLOCATIONS) {
    throw new RangeError(`an expense requires 1-${MAX_EXPENSE_ALLOCATIONS} payers`);
  }
  if (splits.length === 0 || splits.length > MAX_EXPENSE_ALLOCATIONS) {
    throw new RangeError(`an expense requires 1-${MAX_EXPENSE_ALLOCATIONS} participants`);
  }

  assertUniqueUserIds(payers.map(({ userId }) => userId), "payer");
  assertUniqueUserIds(splits.map(({ userId }) => userId), "participant");
  payers.forEach(({ userId, amount }) => {
    assertValidUuid(userId, "payer user ID");
    assertSafePaise(amount, `payment by ${userId}`, false);
  });
  splits.forEach(({ userId, amount }) => {
    assertValidUuid(userId, "participant user ID");
    assertSafePaise(amount, `share for ${userId}`);
  });

  const payerTotal = payers.reduce((sum, payer) => sum + payer.amount, 0);
  const splitTotal = splits.reduce((sum, split) => sum + split.amount, 0);
  if (payerTotal !== totalAmount) {
    throw new RangeError("payer contributions must equal totalAmount");
  }
  if (splitTotal !== totalAmount) {
    throw new RangeError("participant shares must equal totalAmount");
  }
}

export function validateCoreExpense(expense: Expense): void {
  assertValidUuid(expense.id, "expense ID");
  if (expense.groupId !== undefined) assertValidUuid(expense.groupId, "group ID");
  validateExpense(expense);
}
