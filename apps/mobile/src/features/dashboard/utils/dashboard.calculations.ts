import type { ExpenseReadModel } from "../../../services/expenses/expense.types";
import type { DashboardData, PaymentRow } from "../types/dashboard.types";

function grossAmountsForUser(
  expenses: readonly ExpenseReadModel[],
  payments: readonly PaymentRow[],
  userId: string,
): { owe: number; owed: number } {
  const expensePayable = expenses.reduce((total, expense) => {
    const owed = expense.core.splits
      .filter((split) => split.userId === userId)
      .reduce((sum, split) => sum + split.amountOwed, 0);
    const paid = expense.core.payers
      .filter((payer) => payer.userId === userId)
      .reduce((sum, payer) => sum + payer.amountPaid, 0);
    return total + Math.max(0, owed - paid);
  }, 0);
  const expenseReceivable = expenses.reduce((total, expense) => {
    const paid = expense.core.payers
      .filter((payer) => payer.userId === userId)
      .reduce((sum, payer) => sum + payer.amountPaid, 0);
    const owed = expense.core.splits
      .filter((split) => split.userId === userId)
      .reduce((sum, split) => sum + split.amountOwed, 0);
    return total + Math.max(0, paid - owed);
  }, 0);
  const confirmedPayments = payments.filter((payment) => payment.status === "confirmed");
  const sent = confirmedPayments
    .filter((payment) => payment.from_user_id === userId)
    .reduce((total, payment) => total + payment.amount_paise, 0);
  const received = confirmedPayments
    .filter((payment) => payment.to_user_id === userId)
    .reduce((total, payment) => total + payment.amount_paise, 0);

  return {
    owe: Math.max(0, expensePayable - sent),
    owed: Math.max(0, expenseReceivable - received),
  };
}

export function calculateDashboardTotals(
  groupResults: readonly { balance: number; expenses: readonly ExpenseReadModel[]; payments: readonly PaymentRow[] }[],
  userId: string,
): Pick<DashboardData, "balance" | "owe" | "owed"> {
  return groupResults.reduce(
    (result, group) => {
      const gross = grossAmountsForUser(group.expenses, group.payments, userId);
      return {
        balance: result.balance + group.balance,
        owe: result.owe + gross.owe,
        owed: result.owed + gross.owed,
      };
    },
    { balance: 0, owe: 0, owed: 0 },
  );
}
