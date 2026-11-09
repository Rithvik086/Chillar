import { InvalidSettlementError } from "../errors";
import { Paise, addBalance, assertSafePaise } from "../money/money";
import { Balances, validateBalances } from "../balances/calculate";

export interface ProposedSettlement { fromUserId: string; toUserId: string; amount: Paise; status: "proposed" | "confirmed"; }
export function recordProposedSettlement(fromUserId: string, toUserId: string, amount: Paise): ProposedSettlement {
  validateSettlement(fromUserId, toUserId, amount);
  return { fromUserId, toUserId, amount, status: "proposed" };
}
export function applyConfirmedSettlements(balances: Balances, settlements: readonly ProposedSettlement[]): Balances {
  validateBalances(balances);
  const result = new Map(balances.map(({ userId, balance }) => [userId, balance]));
  const seenSettlements = new Map<string, Map<string, Set<Paise>>>();
  for (const settlement of settlements) {
    if (settlement === null || typeof settlement !== "object") throw new InvalidSettlementError("settlement must be an object");
    validateSettlement(settlement.fromUserId, settlement.toUserId, settlement.amount);
    if (settlement.status !== "confirmed") throw new InvalidSettlementError("only confirmed settlements can be applied");
    const recipients = seenSettlements.get(settlement.fromUserId) ?? new Map<string, Set<Paise>>();
    const amounts = recipients.get(settlement.toUserId) ?? new Set<Paise>();
    if (amounts.has(settlement.amount)) throw new InvalidSettlementError("the same settlement cannot be applied twice");
    amounts.add(settlement.amount);
    recipients.set(settlement.toUserId, amounts);
    seenSettlements.set(settlement.fromUserId, recipients);
    const fromBalance = result.get(settlement.fromUserId);
    const toBalance = result.get(settlement.toUserId);
    const owed = fromBalance !== undefined && fromBalance < 0 ? -fromBalance : 0;
    if (settlement.amount > owed) throw new InvalidSettlementError(`${settlement.fromUserId} cannot pay more than the outstanding amount owed`);
    const receivable = toBalance !== undefined && toBalance > 0 ? toBalance : 0;
    if (settlement.amount > receivable) throw new InvalidSettlementError(`${settlement.toUserId} cannot receive more than the outstanding amount`);
    result.set(settlement.fromUserId, addBalance(fromBalance ?? 0, settlement.amount, "settlement balance"));
    result.set(settlement.toUserId, addBalance(toBalance ?? 0, -settlement.amount, "settlement balance"));
  }
  const finalBalances = balances.map(({ userId }) => ({ userId, balance: result.get(userId) ?? 0 }));
  validateBalances(finalBalances);
  return finalBalances;
}
function validateSettlement(fromUserId: string, toUserId: string, amount: Paise): void {
  validateUserId(fromUserId);
  validateUserId(toUserId);
  if (fromUserId === toUserId) throw new InvalidSettlementError("settlement must have distinct non-empty users");
  assertSafePaise(amount, "settlement amount", false);
}
function validateUserId(userId: string): void {
  if (typeof userId !== "string" || userId.trim() === "") throw new InvalidSettlementError("settlement user IDs must be non-empty strings");
}
