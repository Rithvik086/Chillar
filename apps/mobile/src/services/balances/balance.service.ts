import {
  applyConfirmedSettlements,
  assertSafePaise,
  calculateBalances,
  simplifyDebts,
  type Balances,
  type ProposedSettlement,
  type SettlementSuggestion,
} from "@chillar/core";
import { supabase } from "../../utils/supabase";
import { fetchGroupExpenses } from "../expenses/expense.repository";
import type { Database } from "../../types/database.types";
import { assertValidUuid } from "../expenses/expense.validation";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

export interface GroupBalanceResult {
  balances: Balances;
  debts: readonly SettlementSuggestion[];
}

export async function calculateGroupBalances(groupId: string): Promise<GroupBalanceResult> {
  assertValidUuid(groupId, "group ID");
  const [expenses, payments] = await Promise.all([
    fetchGroupExpenses(groupId),
    fetchConfirmedGroupPayments(groupId),
  ]);
  const expenseBalances = calculateBalances(
    expenses.map(({ core }) => core),
    groupId,
  );
  const settledBalances = applyConfirmedSettlements(
    expenseBalances,
    payments.map(mapConfirmedPayment),
  );
  return {
    balances: settledBalances,
    debts: simplifyDebts(settledBalances),
  };
}

export async function fetchConfirmedGroupPayments(groupId: string): Promise<PaymentRow[]> {
  assertValidUuid(groupId, "group ID");
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("group_id", groupId)
    .eq("status", "confirmed")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as unknown as PaymentRow[]).filter((payment) => payment.status === "confirmed");
}

function mapConfirmedPayment(payment: PaymentRow): ProposedSettlement {
  assertValidUuid(payment.from_user_id, "payment sender");
  assertValidUuid(payment.to_user_id, "payment recipient");
  if (payment.currency.trim() !== "INR") throw new TypeError("only INR payments are supported");
  assertSafePaise(payment.amount_paise, "payment amount", false);
  if (payment.status !== "confirmed") throw new TypeError("only confirmed payments can be applied");
  return {
    fromUserId: payment.from_user_id,
    toUserId: payment.to_user_id,
    amount: payment.amount_paise,
    status: "confirmed",
  };
}
