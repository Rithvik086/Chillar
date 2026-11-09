import { supabase } from "@/utils/supabase";
import { fetchGroupExpenses } from "./expense.repository";
import {
  assertValidSplitType,
  assertValidUuid,
  validateExpenseAllocations,
} from "./expense.validation";
import { mapExpenseError } from "./expense.errors";
import type {
  CreateExpenseInput,
  ExpenseReadModel,
  ExpenseMutationInput,
  UpdateExpenseInput,
  VoidExpenseResult,
} from "./expense.types";

const DESCRIPTION_MAX_LENGTH = 140;
const NOTES_MAX_LENGTH = 2000;

export async function createExpense(input: CreateExpenseInput): Promise<ExpenseReadModel> {
  try {
    validateMutationInput(input, "group ID");
    const { data: expenseId, error } = await supabase.rpc("create_expense_multi", {
      p_group_id: input.groupId,
      p_description: input.description.trim(),
      p_amount_paise: input.amountPaise,
      p_payers: input.payers.map(({ userId, amount }) => ({
        user_id: userId,
        amount_paid_paise: amount,
      })),
      p_split_type: input.splitType,
      p_splits: input.splits.map(({ userId, amount }) => ({
        user_id: userId,
        share_amount_paise: amount,
      })),
      p_notes: input.notes ?? null,
    });
    if (error) throw error;
    return await refetchMutationResult(input.groupId, expenseId);
  } catch (error) {
    throw mapExpenseError(error);
  }
}

export async function updateExpense(input: UpdateExpenseInput): Promise<ExpenseReadModel> {
  try {
    validateMutationInput(input, "expense ID");
    const { error } = await supabase.rpc("update_expense_multi", {
      p_expense_id: input.expenseId,
      p_description: input.description.trim(),
      p_amount_paise: input.amountPaise,
      p_payers: input.payers.map(({ userId, amount }) => ({
        user_id: userId,
        amount_paid_paise: amount,
      })),
      p_split_type: input.splitType,
      p_splits: input.splits.map(({ userId, amount }) => ({
        user_id: userId,
        share_amount_paise: amount,
      })),
      p_notes: input.notes ?? null,
    });
    if (error) throw error;
    const expenses = await fetchGroupExpensesForMutation(input.expenseId);
    const updated = expenses.find((expense) => expense.id === input.expenseId);
    if (!updated) throw new Error("Expense not found after update");
    return updated;
  } catch (error) {
    throw mapExpenseError(error);
  }
}

export async function voidExpense(expenseId: string): Promise<VoidExpenseResult> {
  assertValidUuid(expenseId, "expense ID");
  try {
    const { error } = await supabase.rpc("void_expense", {
      p_expense_id: expenseId,
    });
    if (error) throw error;
    return { success: true, expenseId };
  } catch (error) {
    throw mapExpenseError(error);
  }
}

function validateMutationInput(
  input: ExpenseMutationInput & { groupId?: string; expenseId?: string },
  identifierLabel: string,
): void {
  if (input.groupId !== undefined) assertValidUuid(input.groupId, identifierLabel);
  if (input.expenseId !== undefined) assertValidUuid(input.expenseId, identifierLabel);
  if (typeof input.description !== "string" || input.description.trim().length === 0 || input.description.trim().length > DESCRIPTION_MAX_LENGTH) {
    throw new TypeError("description must contain 1-140 characters");
  }
  if (input.notes !== undefined && input.notes !== null && input.notes.length > NOTES_MAX_LENGTH) {
    throw new TypeError("notes cannot exceed 2000 characters");
  }
  assertValidSplitType(input.splitType);
  validateExpenseAllocations(input.amountPaise, input.payers, input.splits);
}

async function refetchMutationResult(groupId: string, expenseId: unknown): Promise<ExpenseReadModel> {
  if (typeof expenseId !== "string") throw new Error("Create expense RPC did not return an expense ID");
  const expenses = await fetchGroupExpenses(groupId);
  const created = expenses.find((expense) => expense.id === expenseId);
  if (!created) throw new Error("Expense not found after create");
  return created;
}

async function fetchGroupExpensesForMutation(expenseId: string): Promise<ExpenseReadModel[]> {
  const result = await fetchGroupExpensesByExpenseId(expenseId);
  return result;
}

async function fetchGroupExpensesByExpenseId(expenseId: string): Promise<ExpenseReadModel[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("group_id")
    .eq("id", expenseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Expense not found after update");
  return fetchGroupExpenses(data.group_id);
}
