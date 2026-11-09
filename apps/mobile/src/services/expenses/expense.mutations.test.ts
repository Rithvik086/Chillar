import { beforeEach, describe, expect, it, vi } from "vitest";
import { createExpense, updateExpense, voidExpense } from "./expense.mutations";
import { ExpenseServiceError } from "./expense.errors";

const { rpc, from, fetchGroupExpenses } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  fetchGroupExpenses: vi.fn(),
}));

vi.mock("../../utils/supabase", () => ({ supabase: { rpc, from } }));
vi.mock("./expense.repository", () => ({ fetchGroupExpenses }));

const groupId = "11111111-1111-4111-8111-111111111111";
const expenseId = "22222222-2222-4222-8222-222222222222";
const payerA = "33333333-3333-4333-8333-333333333333";
const payerB = "44444444-4444-4444-8444-444444444444";
const participant = "55555555-5555-4555-8555-555555555555";
const validInput = {
  groupId,
  description: "Dinner",
  amountPaise: 3000,
  payers: [
    { userId: payerA, amount: 1000 },
    { userId: payerB, amount: 2000 },
  ],
  splits: [{ userId: participant, amount: 3000 }],
  splitType: "exact" as const,
  notes: "Shared",
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchGroupExpenses.mockResolvedValue([{ id: expenseId, groupId }]);
});

describe("expense mutations", () => {
  it("calls create_expense_multi with the exact multi-payer payload and refetches", async () => {
    rpc.mockResolvedValue({ data: expenseId, error: null });
    await createExpense(validInput);
    expect(rpc).toHaveBeenCalledWith("create_expense_multi", {
      p_group_id: groupId,
      p_description: "Dinner",
      p_amount_paise: 3000,
      p_payers: [
        { user_id: payerA, amount_paid_paise: 1000 },
        { user_id: payerB, amount_paid_paise: 2000 },
      ],
      p_split_type: "exact",
      p_splits: [{ user_id: participant, share_amount_paise: 3000 }],
      p_notes: "Shared",
    });
    expect(fetchGroupExpenses).toHaveBeenCalledWith(groupId);
  });

  it("calls update_expense_multi with exact keys and refetches by persisted group", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data: { group_id: groupId }, error: null });
    from.mockReturnValue(query);
    await updateExpense({ ...validInput, expenseId });
    expect(rpc).toHaveBeenCalledWith("update_expense_multi", expect.objectContaining({
      p_expense_id: expenseId,
      p_payers: [
        { user_id: payerA, amount_paid_paise: 1000 },
        { user_id: payerB, amount_paid_paise: 2000 },
      ],
      p_splits: [{ user_id: participant, share_amount_paise: 3000 }],
    }));
    expect(fetchGroupExpenses).toHaveBeenCalledWith(groupId);
  });

  it("calls void_expense with its generated argument name", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(voidExpense(expenseId)).resolves.toEqual({ success: true, expenseId });
    expect(rpc).toHaveBeenCalledWith("void_expense", { p_expense_id: expenseId });
  });

  it("rejects invalid totals and duplicate users before network calls", async () => {
    await expect(createExpense({ ...validInput, amountPaise: 4000 })).rejects.toMatchObject({ kind: "invalid_data" });
    await expect(createExpense({
      ...validInput,
      payers: [{ userId: payerA, amount: 1500 }, { userId: payerA, amount: 1500 }],
    })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports a missing persisted record after a successful RPC", async () => {
    rpc.mockResolvedValue({ data: expenseId, error: null });
    fetchGroupExpenses.mockResolvedValue([]);
    await expect(createExpense(validInput)).rejects.toMatchObject({ kind: "not_found" });
  });

  it("maps permission, missing, and already-voided RPC errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Only the expense creator can edit" } });
    await expect(updateExpense({ ...validInput, expenseId })).rejects.toMatchObject({ kind: "permission", originalCode: "42501" } satisfies Partial<ExpenseServiceError>);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "Expense not found or already voided" } });
    await expect(updateExpense({ ...validInput, expenseId })).rejects.toMatchObject({ kind: "already_voided" });
  });

  it("does not write directly to expense tables", async () => {
    rpc.mockResolvedValue({ data: expenseId, error: null });
    await createExpense(validInput);
    expect(from).not.toHaveBeenCalled();
  });
});
