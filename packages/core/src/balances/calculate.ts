import { Expense } from "../expenses/types";
import { validateExpense } from "../expenses/validation";
import { Paise, addBalance, assertSafeBalance } from "../money/money";
import { InvalidSettlementError } from "../errors";

export interface UserBalance {
  userId: string;
  balance: Paise;
}

export type Balances = readonly UserBalance[];

export function validateBalances(balances: Balances): void {
  const userIds = new Set<string>();
  let total = 0;
  for (const entry of balances) {
    if (typeof entry.userId !== "string" || entry.userId.trim() === "")
      throw new InvalidSettlementError(
        "balance user IDs must be non-empty strings",
      );
    if (userIds.has(entry.userId))
      throw new InvalidSettlementError(
        `duplicate balance user ID "${entry.userId}"`,
      );
    userIds.add(entry.userId);
    assertSafeBalance(entry.balance, `balance for ${entry.userId}`);
    total = addBalance(total, entry.balance, "balance total");
  }
  if (total !== 0)
    throw new InvalidSettlementError("balances must sum to zero");
}

export function calculateBalances(
  expenses: readonly Expense[],
  groupId?: string,
): Balances {
  const expenseIds = new Set<string>();
  for (const expense of expenses) {
    validateExpense(expense);
    if (expenseIds.has(expense.id))
      throw new InvalidSettlementError(`duplicate expense ID "${expense.id}"`);
    expenseIds.add(expense.id);
  }
  const balances = new Map<string, Paise>();
  for (const expense of expenses) {
    if (groupId !== undefined && expense.groupId !== groupId) continue;
    if (expense.status === "voided" || expense.status === "cancelled") continue;
    for (const payer of expense.payers)
      balances.set(
        payer.userId,
        addBalance(balances.get(payer.userId) ?? 0, payer.amountPaid),
      );
    for (const split of expense.splits) {
      const current = balances.get(split.userId) ?? 0;
      balances.set(split.userId, addBalance(current, -split.amountOwed));
    }
  }
  const result = [...balances].map(([userId, balance]) => ({
    userId,
    balance,
  }));
  validateBalances(result);
  return result;
}
