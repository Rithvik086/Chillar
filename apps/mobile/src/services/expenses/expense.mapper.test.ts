import { describe, expect, it } from "vitest";
import { mapExpense } from "./expense.mapper";
import type { ExpensePayerRow, ExpenseRow, ExpenseSplitRow } from "./expense.types";

const groupId = "11111111-1111-4111-8111-111111111111";
const creatorId = "22222222-2222-4222-8222-222222222222";
const payerA = "33333333-3333-4333-8333-333333333333";
const payerB = "44444444-4444-4444-8444-444444444444";
const participant = "55555555-5555-4555-8555-555555555555";

const header: ExpenseRow = {
  id: "66666666-6666-4666-8666-666666666666",
  group_id: groupId,
  description: "Dinner",
  amount_paise: 3000,
  currency: "INR",
  paid_by: payerA,
  created_by: creatorId,
  split_type: "exact",
  notes: "Shared",
  receipt_path: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  voided_at: null,
  voided_by: null,
};

function payer(expense_id: string, user_id: string, amount_paid_paise: number): ExpensePayerRow {
  return { id: crypto.randomUUID(), expense_id, user_id, amount_paid_paise, created_at: header.created_at };
}

function split(expense_id: string, user_id: string, share_amount_paise: number): ExpenseSplitRow {
  return { id: crypto.randomUUID(), expense_id, user_id, share_amount_paise, created_at: header.created_at };
}

describe("mapExpense", () => {
  it("maps independent multi-payer and participant sets", () => {
    const result = mapExpense(
      header,
      [payer(header.id, payerA, 1000), payer(header.id, payerB, 2000)],
      [split(header.id, participant, 3000)],
    );
    expect(result.core.payers).toEqual([
      { userId: payerA, amountPaid: 1000 },
      { userId: payerB, amountPaid: 2000 },
    ]);
    expect(result.core.splits).toEqual([{ userId: participant, amountOwed: 3000 }]);
  });

  it("maps voided_at to the core voided status", () => {
    const result = mapExpense(
      { ...header, voided_at: "2026-01-02T00:00:00Z", voided_by: creatorId },
      [payer(header.id, payerA, 3000)],
      [split(header.id, participant, 3000)],
    );
    expect(result.core.status).toBe("voided");
  });

  it("does not use legacy paid_by as payer data", () => {
    const result = mapExpense(
      { ...header, paid_by: payerB },
      [payer(header.id, payerA, 3000)],
      [split(header.id, participant, 3000)],
    );
    expect(result.core.payers).toEqual([{ userId: payerA, amountPaid: 3000 }]);
  });

  it("rejects unsafe paise values, invalid totals, and duplicate users", () => {
    expect(() =>
      mapExpense(header, [payer(header.id, payerA, Number.MAX_SAFE_INTEGER + 1)], [split(header.id, participant, 3000)]),
    ).toThrow();
    expect(() =>
      mapExpense(header, [payer(header.id, payerA, 2000)], [split(header.id, participant, 3000)]),
    ).toThrow();
    expect(() =>
      mapExpense(header, [payer(header.id, payerA, 1500), payer(header.id, payerA, 1500)], [split(header.id, participant, 3000)]),
    ).toThrow();
  });
});
