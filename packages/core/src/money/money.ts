import { InvalidMonetaryAmountError, UnsafeIntegerOverflowError } from "../errors";

export type Paise = number;

export function assertSafePaise(value: number, name = "amount", allowZero = true): asserts value is Paise {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < 0 || (!allowZero && value === 0)) {
    throw new InvalidMonetaryAmountError(
      `${name} must be a ${allowZero ? "non-negative" : "positive"} safe integer number of paise`,
    );
  }
}

export function assertSafeBalance(value: number, name = "balance"): void {
  if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
    throw new InvalidMonetaryAmountError(`${name} must be a safe integer`);
  }
}

export function addPaise(left: Paise, right: Paise, name = "amount"): Paise {
  assertSafePaise(left, "left " + name);
  assertSafePaise(right, "right " + name);
  const result = left + right;
  if (!Number.isSafeInteger(result) || Object.is(result, -0)) {
    throw new UnsafeIntegerOverflowError(`${name} total exceeds the safe integer range`);
  }
  return result;
}

export function addBalance(left: number, right: number, name = "balance"): number {
  assertSafeBalance(left, "left " + name);
  assertSafeBalance(right, "right " + name);
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new UnsafeIntegerOverflowError(`${name} total exceeds the safe integer range`);
  }
  return result;
}

export function paiseToRupees(paise: Paise): number {
  assertSafePaise(paise);
  return paise / 100;
}

/** @deprecated Use paiseToRupees. */
export const paiseToRuppes = paiseToRupees;

/** Converts an exact decimal rupee string to paise; numeric inputs are intentionally not accepted. */
export function rupeesToPaise(rupees: string): Paise {
  if (typeof rupees !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(rupees)) {
    throw new InvalidMonetaryAmountError("rupees must be a non-negative decimal string with at most two fractional digits");
  }
  const [whole, fraction = ""] = rupees.split(".");
  const paiseBigInt = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (paiseBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new UnsafeIntegerOverflowError("rupees total exceeds the safe integer range");
  }
  return Number(paiseBigInt);
}
