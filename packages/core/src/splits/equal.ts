import { Paise, assertSafePaise } from "../money/money";
import { validateParticipants } from "../expenses/validation";
import { ExpenseSplit } from "../expenses/types";

export function splitEqually(totalAmount: Paise, participantIds: readonly string[]): ExpenseSplit[] {
  assertSafePaise(totalAmount, "totalAmount");
  validateParticipants(participantIds);
  const base = Math.floor(totalAmount / participantIds.length);
  const remainder = totalAmount % participantIds.length;
  return participantIds.map((userId, index) => ({ userId, amountOwed: base + (index < remainder ? 1 : 0) }));
}
