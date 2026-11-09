import { beforeEach, describe, expect, it, vi } from "vitest";
import { cancelSettlement, confirmSettlement, recordSettlement, rejectSettlement } from "./settlement.service";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../../utils/supabase", () => ({ supabase: { from } }));
const { calculateGroupBalances } = vi.hoisted(() => ({ calculateGroupBalances: vi.fn() }));
vi.mock("../balances/balance.service", () => ({ calculateGroupBalances }));

const groupId = "11111111-1111-4111-8111-111111111111";
const sender = "22222222-2222-4222-8222-222222222222";
const recipient = "33333333-3333-4333-8333-333333333333";
const paymentId = "44444444-4444-4444-8444-444444444444";

beforeEach(() => vi.clearAllMocks());

function insertQuery(result: unknown) {
  const query = { insert: vi.fn(), select: vi.fn(), single: vi.fn() };
  query.insert.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.single.mockResolvedValue(result);
  from.mockReturnValue(query);
  return query;
}

function updateQuery(result: unknown) {
  const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);
  from.mockReturnValue(query);
  return query;
}

describe("settlement service", () => {
  it("records a pending payment through the payments table policy", async () => {
    const row = { id: paymentId, status: "pending" };
    const query = insertQuery({ data: row, error: null });
    await expect(recordSettlement({ groupId, fromUserId: sender, toUserId: recipient, amountPaise: 500, method: "upi" })).resolves.toEqual(row);
    expect(query.insert).toHaveBeenCalledWith({
      group_id: groupId,
      from_user_id: sender,
      to_user_id: recipient,
      amount_paise: 500,
      currency: "INR",
      method: "upi",
      status: "pending",
      note: null,
      created_by: sender,
    });
  });

  it("confirms and rejects pending payments as the recipient", async () => {
    const confirmed = updateQuery({ data: { id: paymentId, status: "confirmed" }, error: null });
    calculateGroupBalances.mockResolvedValue({ balances: [], debts: [] });
    const confirmedResult = await confirmSettlement(paymentId);
    expect(confirmedResult.payment).toEqual({ id: paymentId, status: "confirmed" });
    expect(calculateGroupBalances).toHaveBeenCalled();
    expect(confirmed.update).toHaveBeenCalledWith({ status: "confirmed" });
    expect(confirmed.eq).toHaveBeenCalledWith("status", "pending");
    const rejected = updateQuery({ data: { id: paymentId, status: "rejected" }, error: null });
    await rejectSettlement(paymentId);
    expect(rejected.update).toHaveBeenCalledWith({ status: "rejected" });
  });

  it("does not claim cancellation support when RLS does not permit it", async () => {
    await expect(cancelSettlement()).rejects.toThrow(/not supported/);
  });

  it("rejects unsafe amounts and duplicate-submission prevention is not durable", async () => {
    await expect(recordSettlement({ groupId, fromUserId: sender, toUserId: recipient, amountPaise: Number.MAX_SAFE_INTEGER + 1 })).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
});
