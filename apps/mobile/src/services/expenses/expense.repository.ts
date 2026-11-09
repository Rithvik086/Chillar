import { supabase } from "../../utils/supabase";
import type {
  ExpensePayerRow,
  ExpenseReadModel,
  ExpenseReadOptions,
  ExpenseRow,
  ExpenseSplitRow,
} from "./expense.types";
import { assertValidUuid } from "./expense.validation";
import { mapExpense } from "./expense.mapper";

export async function fetchGroupExpenses(
  groupId: string,
  options: ExpenseReadOptions = {},
): Promise<ExpenseReadModel[]> {
  assertValidUuid(groupId, "group ID");

  let expenseQuery = supabase
    .from("expenses")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (!options.includeVoided) expenseQuery = expenseQuery.is("voided_at", null);

  const { data: expenseData, error: expenseError } = await expenseQuery;
  if (expenseError) throw expenseError;
  const expenses = expenseData as unknown as ExpenseRow[];
  if (expenses.length === 0) return [];

  const expenseIds = expenses.map((expense) => expense.id);
  const [payerResult, splitResult] = await Promise.all([
    supabase.from("expense_payers").select("*").in("expense_id", expenseIds),
    supabase.from("expense_splits").select("*").in("expense_id", expenseIds),
  ]);
  if (payerResult.error) throw payerResult.error;
  if (splitResult.error) throw splitResult.error;

  const payers = payerResult.data as unknown as ExpensePayerRow[];
  const splits = splitResult.data as unknown as ExpenseSplitRow[];
  return expenses.map((expense) =>
    mapExpense(
      expense,
      payers.filter((payer) => payer.expense_id === expense.id),
      splits.filter((split) => split.expense_id === expense.id),
    ),
  );
}
