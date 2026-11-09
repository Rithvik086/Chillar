import { supabase } from "../../utils/supabase";
import type { Database } from "../../types/database.types";
import { assertValidUuid } from "../expenses/expense.validation";
import { ExpenseServiceError, mapExpenseError } from "../expenses/expense.errors";
import { calculateGroupBalances, type GroupBalanceResult } from "../balances/balance.service";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
export type PaymentStatus = "pending" | "confirmed" | "rejected" | "cancelled";
export type PaymentMethod = "upi" | "cash" | "bank" | "other";

export interface CreateSettlementInput {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amountPaise: number;
  method?: PaymentMethod;
  note?: string | null;
}

export interface ConfirmedSettlementResult extends GroupBalanceResult {
  payment: PaymentRow;
}

export async function recordSettlement(input: CreateSettlementInput): Promise<PaymentRow> {
  validateSettlementInput(input);
  try {
    const { data, error } = await supabase
      .from("payments")
      .insert({
        group_id: input.groupId,
        from_user_id: input.fromUserId,
        to_user_id: input.toUserId,
        amount_paise: input.amountPaise,
        currency: "INR",
        method: input.method ?? "other",
        status: "pending",
        note: input.note ?? null,
        created_by: input.fromUserId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as PaymentRow;
  } catch (error) {
    throw mapExpenseError(error);
  }
}

export async function fetchGroupPaymentHistory(groupId: string): Promise<PaymentRow[]> {
  assertValidUuid(groupId, "group ID");
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw mapExpenseError(error);
  return data as unknown as PaymentRow[];
}

export async function confirmSettlement(paymentId: string): Promise<ConfirmedSettlementResult> {
  const payment = await updatePendingSettlement(paymentId, "confirmed");
  const balances = await calculateGroupBalances(payment.group_id);
  return { payment, ...balances };
}

export async function rejectSettlement(paymentId: string): Promise<PaymentRow> {
  return updatePendingSettlement(paymentId, "rejected");
}

export async function cancelSettlement(): Promise<never> {
  throw new ExpenseServiceError("permission", "Payment cancellation is not supported by the current database policy.");
}

async function updatePendingSettlement(paymentId: string, status: "confirmed" | "rejected"): Promise<PaymentRow> {
  assertValidUuid(paymentId, "payment ID");
  try {
    const { data, error } = await supabase
      .from("payments")
      .update({ status })
      .eq("id", paymentId)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ExpenseServiceError("not_found", "The pending payment could not be found.");
    return data as unknown as PaymentRow;
  } catch (error) {
    if (error instanceof ExpenseServiceError) throw error;
    throw mapExpenseError(error);
  }
}

function validateSettlementInput(input: CreateSettlementInput): void {
  assertValidUuid(input.groupId, "group ID");
  assertValidUuid(input.fromUserId, "sender");
  assertValidUuid(input.toUserId, "recipient");
  if (input.fromUserId === input.toUserId) throw new TypeError("sender and recipient must differ");
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new TypeError("settlement amount must be a positive safe integer number of paise");
  }
  if (input.note !== undefined && input.note !== null && input.note.length > 500) {
    throw new TypeError("payment note cannot exceed 500 characters");
  }
}
