import {
  validateExpense,
  type Expense,
  type ExpensePayer,
  type ExpenseSplit,
} from "@chillar/core";
import type {
  ExpensePayerRow,
  ExpenseReadModel,
  ExpenseRow,
  ExpenseSplitRow,
} from "./expense.types";
import {
  assertValidSplitType,
  assertValidUuid,
  validateExpenseAllocations,
} from "./expense.validation";

export function mapExpense(
  row: ExpenseRow,
  payerRows: readonly ExpensePayerRow[],
  splitRows: readonly ExpenseSplitRow[],
): ExpenseReadModel {
  assertValidUuid(row.id, "expense ID");
  assertValidUuid(row.group_id, "group ID");
  assertValidUuid(row.created_by, "created by");
  assertValidUuid(row.paid_by, "legacy paid_by");
  if (row.voided_by !== null) assertValidUuid(row.voided_by, "voided by");
  if (row.currency.trim() !== "INR") throw new TypeError("only INR expenses are supported");
  assertValidSplitType(row.split_type);

  const payers: ExpensePayer[] = payerRows.map((payer) => {
    assertValidUuid(payer.expense_id, "payer expense ID");
    assertValidUuid(payer.user_id, "payer user ID");
    return { userId: payer.user_id, amountPaid: payer.amount_paid_paise };
  });
  const splits: ExpenseSplit[] = splitRows.map((split) => {
    assertValidUuid(split.expense_id, "split expense ID");
    assertValidUuid(split.user_id, "participant user ID");
    return { userId: split.user_id, amountOwed: split.share_amount_paise };
  });

  if (payerRows.some((payer) => payer.expense_id !== row.id)) {
    throw new TypeError("payer row does not belong to the expense");
  }
  if (splitRows.some((split) => split.expense_id !== row.id)) {
    throw new TypeError("split row does not belong to the expense");
  }

  validateExpenseAllocations(
    row.amount_paise,
    payers.map(({ userId, amountPaid }) => ({ userId, amount: amountPaid })),
    splits.map(({ userId, amountOwed }) => ({ userId, amount: amountOwed })),
  );

  const core: Expense = {
    id: row.id,
    groupId: row.group_id,
    totalAmount: row.amount_paise,
    currency: "INR",
    payers,
    splits,
    status: row.voided_at === null ? "active" : "voided",
  };
  validateExpense(core);

  return {
    id: row.id,
    groupId: row.group_id,
    description: row.description,
    notes: row.notes,
    receiptPath: row.receipt_path,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    voidedAt: row.voided_at,
    voidedBy: row.voided_by,
    core,
  };
}
