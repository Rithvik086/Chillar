import { InvalidSettlementError } from "../errors";
import { Paise, addBalance } from "../money/money";
import { Balances, validateBalances } from "../balances/calculate";

export interface SettlementSuggestion {
  fromUserId: string;
  toUserId: string;
  amount: Paise;
}
export function simplifyDebts(balances: Balances): SettlementSuggestion[] {
  validateBalances(balances);
  const debtors = balances
    .filter(({ balance }) => balance < 0)
    .map(({ userId, balance }) => ({ userId, amount: -balance }));
  const creditors = balances
    .filter(({ balance }) => balance > 0)
    .map(({ userId, balance }) => ({ userId, amount: balance }));
  const debtTotal = debtors.reduce(
    (sum, item) => addBalance(sum, item.amount, "debtor total"),
    0,
  );
  const creditTotal = creditors.reduce(
    (sum, item) => addBalance(sum, item.amount, "creditor total"),
    0,
  );
  if (debtTotal !== creditTotal)
    throw new InvalidSettlementError("debtor and creditor totals must match");
  const result: SettlementSuggestion[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const amount = Math.min(
      debtors[debtorIndex].amount,
      creditors[creditorIndex].amount,
    );
    if (amount <= 0)
      throw new InvalidSettlementError("settlement amount must be positive");
    result.push({
      fromUserId: debtors[debtorIndex].userId,
      toUserId: creditors[creditorIndex].userId,
      amount,
    });
    debtors[debtorIndex].amount -= amount;
    creditors[creditorIndex].amount -= amount;
    if (debtors[debtorIndex].amount === 0) debtorIndex += 1;
    if (creditors[creditorIndex].amount === 0) creditorIndex += 1;
  }
  return result;
}
