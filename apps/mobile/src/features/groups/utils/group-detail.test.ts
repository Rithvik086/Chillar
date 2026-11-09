import { describe, expect, it } from "vitest";
import { buildGroupActivities, expenseImpactForUser } from "./group-detail";

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";

function expense(status: "active" | "voided" = "active") {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    groupId: "44444444-4444-4444-8444-444444444444",
    description: "Dinner",
    notes: null,
    receiptPath: null,
    createdBy: userId,
    createdAt: "2026-01-02T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    voidedAt: status === "voided" ? "2026-01-03T00:00:00Z" : null,
    voidedBy: status === "voided" ? userId : null,
    core: {
      id: "33333333-3333-4333-8333-333333333333",
      groupId: "44444444-4444-4444-8444-444444444444",
      totalAmount: 1000,
      currency: "INR" as const,
      payers: [{ userId, amountPaid: 1000 }],
      splits: [{ userId, amountOwed: 500 }, { userId: otherUserId, amountOwed: 500 }],
      status,
    },
  };
}

describe("group detail activity mapping", () => {
  it("calculates a user's impact from payers and splits, not paid_by", () => {
    expect(expenseImpactForUser(expense(), userId)).toBe(500);
  });

  it("keeps voided expenses visible but marks them and pending settlements non-financial", () => {
    const activities = buildGroupActivities(
      [expense("voided")],
      [{
        id: "55555555-5555-4555-8555-555555555555",
        group_id: "44444444-4444-4444-8444-444444444444",
        amount_paise: 400,
        confirmed_at: null,
        created_at: "2026-01-04T00:00:00Z",
        created_by: otherUserId,
        currency: "INR",
        from_user_id: userId,
        method: "upi",
        note: null,
        status: "pending",
        to_user_id: otherUserId,
        updated_at: "2026-01-04T00:00:00Z",
      }],
      userId,
    );
    expect(activities[0]).toMatchObject({ kind: "settlement", impactPaise: null });
    expect(activities[1]).toMatchObject({ kind: "expense", voided: true });
  });
});
