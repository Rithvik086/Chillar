import type { UserBalance } from "@chillar/core";
import { calculateGroupBalances } from "../../../services/balances/balance.service";
import { fetchGroupExpenses } from "../../../services/expenses/expense.repository";
import type { ExpenseReadModel } from "../../../services/expenses/expense.types";
import { fetchGroupPaymentHistory } from "../../../services/settlements/settlement.service";
import { fetchUserGroups } from "../../../services/groups/group.service";
import type { DashboardActivity, DashboardData, DashboardGroup, PaymentRow } from "../types/dashboard.types";
import { calculateDashboardTotals } from "../utils/dashboard.calculations";

function balanceForUser(balances: readonly UserBalance[], userId: string): number {
  return balances.find((entry) => entry.userId === userId)?.balance ?? 0;
}

function expenseImpactForUser(expense: ExpenseReadModel, userId: string): number {
  const paid = expense.core.payers
    .filter((payer) => payer.userId === userId)
    .reduce((total, payer) => total + payer.amountPaid, 0);
  const owed = expense.core.splits
    .filter((split) => split.userId === userId)
    .reduce((total, split) => total + split.amountOwed, 0);
  return paid - owed;
}

function latestActivity(expenses: readonly ExpenseReadModel[], payments: readonly PaymentRow[]): string | null {
  const dates = [
    ...expenses.map((expense) => expense.createdAt),
    ...payments.filter((payment) => payment.status === "confirmed").map((payment) => payment.created_at),
  ];
  return dates.sort((a, b) => b.localeCompare(a))[0] ?? null;
}

export async function fetchDashboard(userId: string): Promise<DashboardData> {
  const userGroups = await fetchUserGroups(userId);
  const results = await Promise.all(userGroups.map(async ({ group, memberCount }) => {
    const [balanceResult, expenses, payments] = await Promise.all([
      calculateGroupBalances(group.id),
      fetchGroupExpenses(group.id),
      fetchGroupPaymentHistory(group.id),
    ]);
    return {
      group,
      memberCount,
      balance: balanceForUser(balanceResult.balances, userId),
      expenses,
      payments,
      lastActivityAt: latestActivity(expenses, payments),
    };
  }));
  const totals = calculateDashboardTotals(results, userId);
  const groups: DashboardGroup[] = results.map(({ expenses: _expenses, payments: _payments, ...result }) => result);
  const activities: DashboardActivity[] = results.flatMap(({ group, expenses, payments }) => [
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      description: expense.description,
      groupName: group.name,
      detail: `Paid by ${expense.core.payers.some((payer) => payer.userId === userId) ? "you" : "a group member"}`,
      date: expense.createdAt,
      amount: expenseImpactForUser(expense, userId),
    })),
    ...payments.filter((payment) => payment.status === "confirmed").map((payment) => ({
      id: `payment-${payment.id}`,
      description: payment.note?.trim() || "Settlement",
      groupName: group.name,
      detail: `Initiated by ${payment.created_by === userId ? "you" : "a group member"}`,
      date: payment.created_at,
      amount: payment.from_user_id === userId ? -payment.amount_paise : payment.amount_paise,
    })),
  ]).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return { groups, activities, ...totals };
}
