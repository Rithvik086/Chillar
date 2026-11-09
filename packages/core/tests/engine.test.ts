import { describe, expect, it } from "vitest";
import {
  applyConfirmedSettlements, calculateBalances, recordProposedSettlement, simplifyDebts,
  allocateProportionally, rupeesToPaise, splitByExactAmounts, splitByPercentage, splitByShares, splitEqually, validateExpense,
  DuplicateUserIdError, PercentageTotalMismatchError, SplitTotalMismatchError,
} from "../src";

describe("splitting", () => {
  it("splits equally and allocates remainders in input order", () => {
    expect(splitEqually(100, ["alice", "bob", "charlie"])).toEqual([
      { userId: "alice", amountOwed: 34 }, { userId: "bob", amountOwed: 33 }, { userId: "charlie", amountOwed: 33 },
    ]);
    expect(splitEqually(99, ["a", "b", "c"])).toEqual([
      { userId: "a", amountOwed: 33 }, { userId: "b", amountOwed: 33 }, { userId: "c", amountOwed: 33 },
    ]);
  });
  it("supports exact, percentage, and weighted shares", () => {
    expect(splitByExactAmounts(100, [{ userId: "a", amount: 40 }, { userId: "b", amount: 60 }])).toEqual([
      { userId: "a", amountOwed: 40 }, { userId: "b", amountOwed: 60 },
    ]);
    expect(splitByPercentage(10000, [{ userId: "a", percentage: "33.33" }, { userId: "b", percentage: "33.33" }, { userId: "c", percentage: "33.34" }]).map((x) => x.amountOwed)).toEqual([3333, 3333, 3334]);
    expect(splitByShares(100, [{ userId: "a", shares: 1 }, { userId: "b", shares: 2 }])).toEqual([
      { userId: "a", amountOwed: 34 }, { userId: "b", amountOwed: 66 },
    ]);
  });
  it("rejects duplicate IDs and invalid totals", () => {
    expect(() => splitEqually(100, ["a", "a"])).toThrow(DuplicateUserIdError);
    expect(() => splitByExactAmounts(100, [{ userId: "a", amount: 99 }])).toThrow(SplitTotalMismatchError);
    expect(() => splitByPercentage(100, [{ userId: "a", percentage: 50 }])).toThrow(PercentageTotalMismatchError);
    expect(() => splitEqually(-1, ["a"])).toThrow();
    expect(() => splitByShares(100, [{ userId: "a", shares: 0 }])).toThrow();
  });
  it("preserves conservation at the maximum safe paise boundary", () => {
    const total = Number.MAX_SAFE_INTEGER;
    const percentage = splitByPercentage(total, [{ userId: "a", percentage: "50" }, { userId: "b", percentage: "50" }]);
    const shares = splitByShares(total, [{ userId: "a", shares: 1 }, { userId: "b", shares: 2 }]);
    expect(percentage.reduce((sum, split) => sum + split.amountOwed, 0)).toBe(total);
    expect(shares.reduce((sum, split) => sum + split.amountOwed, 0)).toBe(total);
    expect(splitByExactAmounts(total, [{ userId: "a", amount: 1 }, { userId: "b", amount: total - 1 }])).toHaveLength(2);
  });
  it("supports zero allocations and rejects invalid proportional inputs", () => {
    expect(splitByPercentage(100, [{ userId: "a", percentage: "0" }, { userId: "b", percentage: "100" }])).toEqual([
      { userId: "a", amountOwed: 0 }, { userId: "b", amountOwed: 100 },
    ]);
    expect(allocateProportionally(100, [{ userId: "a", weight: 1 }, { userId: "b", weight: 2 }])).toEqual([
      { userId: "a", amount: 34 }, { userId: "b", amount: 66 },
    ]);
    expect(() => allocateProportionally(100, [])).toThrow();
    expect(() => allocateProportionally(100, [{ userId: "", weight: 1 }])).toThrow();
    expect(() => allocateProportionally(100, [{ userId: "a", weight: 1 }, { userId: "a", weight: 2 }])).toThrow(DuplicateUserIdError);
    expect(() => allocateProportionally(100, [{ userId: "a", weight: 0 }])).toThrow();
    expect(() => splitByPercentage(100, [{ userId: "a", percentage: "100.01" }])).toThrow();
    expect(() => splitByPercentage(100, [{ userId: "a", percentage: "1.001" }])).toThrow();
    expect(() => splitByPercentage(100, [{ userId: "a", percentage: "9007199254740992" }])).toThrow();
  });
  it("parses rupees exactly at the financial boundary", () => {
    expect(rupeesToPaise("125.50")).toBe(12550);
    expect(rupeesToPaise("0.5")).toBe(50);
    expect(() => rupeesToPaise("1.001")).toThrow();
    expect(() => rupeesToPaise("-1.00")).toThrow();
    expect(() => rupeesToPaise("Infinity")).toThrow();
    expect(() => rupeesToPaise("NaN")).toThrow();
    expect(() => rupeesToPaise("90071992547409.92")).toThrow();
  });
  it("is deterministic for large participant collections", () => {
    const participants = Array.from({ length: 1000 }, (_, index) => `user-${index}`);
    const first = splitEqually(1000, participants);
    expect(splitEqually(1000, participants)).toEqual(first);
    expect(first.reduce((sum, split) => sum + split.amountOwed, 0)).toBe(1000);
  });
});

const expense = {
  id: "dinner", groupId: "g1", totalAmount: 1600, currency: "INR" as const,
  payers: [{ userId: "bob", amountPaid: 300 }, { userId: "charlie", amountPaid: 1300 }],
  splits: [{ userId: "alice", amountOwed: 400 }, { userId: "bob", amountOwed: 400 }, { userId: "charlie", amountOwed: 400 }, { userId: "david", amountOwed: 400 }],
};

describe("balances and settlements", () => {
  it("keeps payer and participant roles independent", () => {
    const balances = calculateBalances([expense]);
    expect(balances).toEqual([
      { userId: "bob", balance: -100 }, { userId: "charlie", balance: 900 },
      { userId: "alice", balance: -400 }, { userId: "david", balance: -400 },
    ]);
    expect(balances.reduce((sum, entry) => sum + entry.balance, 0)).toBe(0);
    expect(simplifyDebts(balances)).toEqual([
      { fromUserId: "bob", toUserId: "charlie", amount: 100 },
      { fromUserId: "alice", toUserId: "charlie", amount: 400 },
      { fromUserId: "david", toUserId: "charlie", amount: 400 },
    ]);
  });
  it("filters groups and voided expenses without mutating inputs", () => {
    const input = [{ ...expense, payers: [...expense.payers], splits: [...expense.splits] }];
    const before = JSON.stringify(input);
    expect(calculateBalances([input[0], { ...expense, id: "void", groupId: "g2", status: "voided" }], "g1")).toEqual(calculateBalances(input));
    expect(JSON.stringify(input)).toBe(before);
  });
  it("applies only confirmed partial settlements", () => {
    const proposed = recordProposedSettlement("alice", "charlie", 100);
    expect(() => applyConfirmedSettlements(calculateBalances([expense]), [proposed])).toThrow();
    const confirmed = { ...proposed, status: "confirmed" as const };
    const result = applyConfirmedSettlements(calculateBalances([expense]), [confirmed]);
    expect(result.find(({ userId }) => userId === "alice")?.balance).toBe(-300);
    expect(result.find(({ userId }) => userId === "charlie")?.balance).toBe(800);
  });
  it("preserves conservation across multiple partial settlements", () => {
    const balances = [{ userId: "alice", balance: -300 }, { userId: "charlie", balance: 300 }];
    const settlements = [
      { fromUserId: "alice", toUserId: "charlie", amount: 100, status: "confirmed" as const },
      { fromUserId: "alice", toUserId: "charlie", amount: 200, status: "confirmed" as const },
    ];
    const result = applyConfirmedSettlements(balances, settlements);
    expect(result).toEqual([{ userId: "alice", balance: 0 }, { userId: "charlie", balance: 0 }]);
    expect(result.reduce((sum, entry) => sum + entry.balance, 0)).toBe(0);
    expect(() => applyConfirmedSettlements(balances, [settlements[0], settlements[0]])).toThrow();
  });
  it("rejects invalid and non-zero-sum balance maps", () => {
    expect(simplifyDebts([])).toEqual([]);
    expect(() => simplifyDebts([{ userId: "alice", balance: Number.NaN }])).toThrow();
    expect(() => simplifyDebts([{ userId: "alice", balance: 100 }])).toThrow();
    expect(() => simplifyDebts([{ userId: "alice", balance: -100 }, { userId: "bob", balance: -100 }])).toThrow();
    expect(() => applyConfirmedSettlements([{ userId: "alice", balance: Number.POSITIVE_INFINITY }], [])).toThrow();
  });
  it("validates inactive expenses and duplicate expense IDs", () => {
    expect(() => calculateBalances([{ ...expense, status: "voided", splits: [{ userId: "alice", amountOwed: 1 }] }])).toThrow();
    expect(() => calculateBalances([expense, { ...expense }])).toThrow();
  });
  it("supports arbitrary IDs and JSON round trips", () => {
    const arbitraryExpense = {
      id: "arbitrary", totalAmount: 100, currency: "INR" as const,
      payers: [{ userId: "__proto__", amountPaid: 100 }],
      splits: [{ userId: "constructor", amountOwed: 100 }],
    };
    const arbitraryBalances = calculateBalances([arbitraryExpense]);
    expect(JSON.parse(JSON.stringify(arbitraryBalances))).toEqual(arbitraryBalances);

    const nulBalances = [
      { userId: "a\u0000b", balance: -10 }, { userId: "c", balance: 10 },
      { userId: "a", balance: -20 }, { userId: "b\u0000c", balance: 20 },
    ];
    const distinct = applyConfirmedSettlements(nulBalances, [
      { fromUserId: "a\u0000b", toUserId: "c", amount: 5, status: "confirmed" as const },
      { fromUserId: "a", toUserId: "b\u0000c", amount: 5, status: "confirmed" as const },
    ]);
    expect(distinct.find(({ userId }) => userId === "a\u0000b")?.balance).toBe(-5);
    expect(() => applyConfirmedSettlements(nulBalances, [
      { fromUserId: "a\u0000b", toUserId: "c", amount: 5, status: "confirmed" as const },
      { fromUserId: "a\u0000b", toUserId: "c", amount: 5, status: "confirmed" as const },
    ])).toThrow();
  });
  it("validates complete expenses", () => {
    expect(() => validateExpense({ ...expense, splits: [{ userId: "alice", amountOwed: 1 }] })).toThrow(SplitTotalMismatchError);
  });
});
