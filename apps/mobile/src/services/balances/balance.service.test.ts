import { describe, expect, it, vi } from "vitest";
import { calculateGroupBalances } from "./balance.service";

const { fetchGroupExpenses, from } = vi.hoisted(() => ({
  fetchGroupExpenses: vi.fn(),
  from: vi.fn(),
}));
vi.mock("../expenses/expense.repository", () => ({ fetchGroupExpenses }));
vi.mock("../../utils/supabase", () => ({ supabase: { from } }));

const groupId = "11111111-1111-4111-8111-111111111111";
const payerA = "22222222-2222-4222-8222-222222222222";
const payerB = "33333333-3333-4333-8333-333333333333";
const participantA = "44444444-4444-4444-8444-444444444444";
const participantB = "55555555-5555-4555-8555-555555555555";

const expense = (payers: { userId: string; amountPaid: number }[], splits: { userId: string; amountOwed: number }[], status: "active" | "voided" = "active") => ({
  core: {
    id: crypto.randomUUID(),
    groupId,
    totalAmount: 1000,
    currency: "INR" as const,
    payers,
    splits,
    status,
  },
});

function payment(from_user_id: string, to_user_id: string, amount_paise: number, status: string) {
  return {
    id: crypto.randomUUID(),
    group_id: groupId,
    from_user_id,
    to_user_id,
    amount_paise,
    currency: "INR",
    method: "upi",
    status,
    note: null,
    created_by: from_user_id,
    confirmed_at: status === "confirmed" ? "2026-01-01T00:00:00Z" : null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("calculateGroupBalances", () => {
  it("calculates multiple payer balances with unequal splits", async () => {
    fetchGroupExpenses.mockResolvedValue([
      expense(
        [{ userId: payerA, amountPaid: 600 }, { userId: payerB, amountPaid: 400 }],
        [{ userId: participantA, amountOwed: 700 }, { userId: participantB, amountOwed: 300 }],
      ),
    ]);
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [], error: null });
    from.mockReturnValue(query);
    const result = await calculateGroupBalances(groupId);
    expect(result.balances).toEqual([
      { userId: payerA, balance: 600 },
      { userId: payerB, balance: 400 },
      { userId: participantA, balance: -700 },
      { userId: participantB, balance: -300 },
    ]);
  });

  it("calculates equal split balances", async () => {
    fetchGroupExpenses.mockResolvedValue([
      expense(
        [{ userId: payerA, amountPaid: 1000 }],
        [{ userId: participantA, amountOwed: 500 }, { userId: participantB, amountOwed: 500 }],
      ),
    ]);
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [], error: null });
    from.mockReturnValue(query);
    const result = await calculateGroupBalances(groupId);
    expect(result.balances).toEqual([
      { userId: payerA, balance: 1000 },
      { userId: participantA, balance: -500 },
      { userId: participantB, balance: -500 },
    ]);
  });

  it("applies confirmed settlements and excludes pending, rejected, and cancelled payments", async () => {
    fetchGroupExpenses.mockResolvedValue([
      expense([{ userId: payerA, amountPaid: 1000 }], [{ userId: participantA, amountOwed: 1000 }]),
    ]);
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({
      data: [
        payment(participantA, payerA, 400, "confirmed"),
        payment(participantA, payerA, 100, "pending"),
        payment(participantA, payerA, 100, "rejected"),
        payment(participantA, payerA, 100, "cancelled"),
      ],
      error: null,
    });
    from.mockReturnValue(query);
    const result = await calculateGroupBalances(groupId);
    expect(result.balances).toEqual([
      { userId: payerA, balance: 600 },
      { userId: participantA, balance: -600 },
    ]);
  });

  it("simplifies debts and excludes voided expenses", async () => {
    fetchGroupExpenses.mockResolvedValue([
      expense([{ userId: payerA, amountPaid: 1000 }], [{ userId: participantA, amountOwed: 1000 }]),
      expense([{ userId: payerB, amountPaid: 1000 }], [{ userId: participantB, amountOwed: 1000 }], "voided"),
    ]);
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [], error: null });
    from.mockReturnValue(query);
    const result = await calculateGroupBalances(groupId);
    expect(result.debts).toEqual([{ fromUserId: participantA, toUserId: payerA, amount: 1000 }]);
  });

  it("rejects unsafe payment paise values", async () => {
    fetchGroupExpenses.mockResolvedValue([]);
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({
      data: [payment(participantA, payerA, Number.MAX_SAFE_INTEGER + 1, "confirmed")],
      error: null,
    });
    from.mockReturnValue(query);
    await expect(calculateGroupBalances(groupId)).rejects.toThrow();
  });
});
