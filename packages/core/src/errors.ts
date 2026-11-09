export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class InvalidMonetaryAmountError extends DomainError {}
export class DuplicateUserIdError extends DomainError {}
export class EmptyParticipantsError extends DomainError {}
export class InvalidPayerAllocationError extends DomainError {}
export class InvalidSplitAllocationError extends DomainError {}
export class PercentageTotalMismatchError extends DomainError {}
export class InvalidShareWeightsError extends DomainError {}
export class PayerTotalMismatchError extends DomainError {}
export class SplitTotalMismatchError extends DomainError {}
export class InvalidSettlementError extends DomainError {}
export class UnsafeIntegerOverflowError extends DomainError {}
