import { describe, expect, it } from "vitest";
import type { ExpenseReadModel } from "../../../services/expenses/expense.types";
import { calculateDashboardTotals } from "../utils/dashboard.calculations";

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";

function expense(
  payers: { userId: string; amountPaid: number }[],
  splits: { userId: string; amountOwed: number }[],
): ExpenseReadModel {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    groupId: "44444444-4444-4444-8444-444444444444",
    description: "Dinner",
    notes: null,
    receiptPath: null,
    createdBy: userId,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    voidedAt: null,
    voidedBy: null,
    core: {
      id: "33333333-3333-4333-8333-333333333333",
      groupId: "44444444-4444-4444-8444-444444444444",
      totalAmount: 1000,
      currency: "INR",
      payers,
      splits,
      status: "active",
    },
  };
}

describe("calculateDashboardTotals", () => {
  it("keeps payable and receivable totals separate", () => {
    const result = calculateDashboardTotals([
      {
        balance: 500,
        expenses: [
          expense(
            [{ userId, amountPaid: 1000 }],
            [{ userId, amountOwed: 500 }, { userId: otherUserId, amountOwed: 500 }],
          ),
          expense(
            [{ userId: otherUserId, amountPaid: 500 }],
            [{ userId, amountOwed: 500 }],
          ),
        ],
        payments: [],
      },
    ], userId);

    expect(result).toEqual({ balance: 500, owe: 500, owed: 500 });
  });

  it("reduces gross directions only for confirmed settlements", () => {
    const result = calculateDashboardTotals([
      {
        balance: 500,
        expenses: [expense(
          [{ userId: userId, amountPaid: 1000 }],
          [{ userId: otherUserId, amountOwed: 1000 }],
        )],
        payments: [{
          id: "55555555-5555-4555-8555-555555555555",
          group_id: "44444444-4444-4444-8444-444444444444",
          from_user_id: otherUserId,
          to_user_id: userId,
          amount_paise: 250,
          currency: "INR",
          method: "upi",
          status: "pending",
          note: null,
          created_by: otherUserId,
          confirmed_at: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        }, {
          id: "66666666-6666-4666-8666-666666666666",
          group_id: "44444444-4444-4444-8444-444444444444",
          from_user_id: otherUserId,
          to_user_id: userId,
          amount_paise: 250,
          currency: "INR",
          method: "upi",
          status: "confirmed",
          note: null,
          created_by: otherUserId,
          confirmed_at: "2026-01-01T00:00:00Z",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        }],
      },
    ], userId);

    expect(result).toEqual({ balance: 500, owe: 0, owed: 750 });
  });
});
