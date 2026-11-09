import type { Expense } from "@chillar/core";
import type { Database } from "@/types/database.types";

export type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
export type ExpensePayerRow = Database["public"]["Tables"]["expense_payers"]["Row"];
export type ExpenseSplitRow = Database["public"]["Tables"]["expense_splits"]["Row"];

export type ExpenseSplitType = "equal" | "exact" | "percentage" | "shares";

export interface ExpenseReadModel {
  id: string;
  groupId: string;
  description: string;
  notes: string | null;
  receiptPath: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  voidedAt: string | null;
  voidedBy: string | null;
  core: Expense;
}

export interface ExpenseReadOptions {
  includeVoided?: boolean;
}

export interface ExpenseAllocationInput {
  userId: string;
  amount: number;
}

export interface ExpenseMutationInput {
  description: string;
  amountPaise: number;
  payers: readonly ExpenseAllocationInput[];
  splits: readonly ExpenseAllocationInput[];
  splitType: ExpenseSplitType;
  notes?: string | null;
}

export interface CreateExpenseInput extends ExpenseMutationInput {
  groupId: string;
}

export interface UpdateExpenseInput extends ExpenseMutationInput {
  expenseId: string;
}

export interface VoidExpenseResult {
  success: true;
  expenseId: string;
}
