import type { ExpenseReadModel } from "@/services/expenses/expense.types";
import type { PaymentRow, GroupActivity } from "@/features/groups/types/group-detail.types";

export function expenseImpactForUser(expense: ExpenseReadModel, userId: string): number {
  const paid = expense.core.payers
    .filter((payer) => payer.userId === userId)
    .reduce((total, payer) => total + payer.amountPaid, 0);
  const owed = expense.core.splits
    .filter((split) => split.userId === userId)
    .reduce((total, split) => total + split.amountOwed, 0);
  return paid - owed;
}

export function buildGroupActivities(
  expenses: readonly ExpenseReadModel[],
  payments: readonly PaymentRow[],
  userId: string,
): GroupActivity[] {
  return [
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      kind: "expense" as const,
      description: expense.description,
      detail: `Paid by ${expense.core.payers.length > 1 ? "multiple people" : expense.core.payers[0]?.userId === userId ? "you" : "a group member"}`,
      date: expense.createdAt,
      amountPaise: expense.core.totalAmount,
      impactPaise: expenseImpactForUser(expense, userId),
      voided: expense.core.status === "voided" || expense.core.status === "cancelled",
    })),
    ...payments.map((payment) => ({
      id: `payment-${payment.id}`,
      kind: "settlement" as const,
      description: payment.note?.trim() || "Settlement",
      detail: `Initiated by ${payment.created_by === userId ? "you" : "a group member"}`,
      date: payment.created_at,
      amountPaise: payment.amount_paise,
      impactPaise:
        payment.status === "confirmed"
          ? payment.from_user_id === userId
            ? -payment.amount_paise
            : payment.to_user_id === userId
              ? payment.amount_paise
              : 0
          : null,
      voided: false,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}
