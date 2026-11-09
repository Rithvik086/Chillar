export type ExpenseErrorKind =
  | "authentication"
  | "permission"
  | "not_found"
  | "already_voided"
  | "invalid_data"
  | "duplicate"
  | "network"
  | "unexpected";

interface SupabaseLikeError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

export class ExpenseServiceError extends Error {
  readonly kind: ExpenseErrorKind;
  readonly originalCode: string | undefined;
  readonly originalMessage: string | undefined;

  constructor(
    kind: ExpenseErrorKind,
    message: string,
    original?: SupabaseLikeError,
  ) {
    super(message);
    this.name = "ExpenseServiceError";
    this.kind = kind;
    this.originalCode = original?.code;
    this.originalMessage = original?.message;
  }
}

export function mapExpenseError(error: unknown): ExpenseServiceError {
  const source = isSupabaseLikeError(error) ? error : undefined;
  const code = source?.code;
  const text = `${code ?? ""} ${source?.message ?? (error instanceof Error ? error.message : "")}`.toLowerCase();

  if (code === "28000" || code === "401" || text.includes("authentication required") || text.includes("jwt")) {
    return new ExpenseServiceError("authentication", "Your session has expired. Please sign in again.", source);
  }
  if (code === "42501" || code === "403" || text.includes("permission denied") || text.includes("only the expense")) {
    return new ExpenseServiceError("permission", "You do not have permission to change this expense.", source);
  }
  if (code === "P0002" && text.includes("already voided")) {
    return new ExpenseServiceError("already_voided", "This expense has already been voided.", source);
  }
  if (code === "P0002" || text.includes("not found")) {
    return new ExpenseServiceError("not_found", "The expense could not be found.", source);
  }
  if (code === "23505" || text.includes("duplicate")) {
    return new ExpenseServiceError("duplicate", "Each payer and participant must be unique.", source);
  }
  if (
    code === "22023" ||
    code === "23514" ||
    text.includes("invalid expense") ||
    text.includes("must equal") ||
    text.includes("must contain")
  ) {
    return new ExpenseServiceError("invalid_data", "The expense details are invalid.", source);
  }
  if (!source && (error instanceof TypeError || error instanceof Error) && isNetworkError(error)) {
    return new ExpenseServiceError("network", "The request could not be completed. Check your connection and try again.", undefined);
  }
  if (error instanceof TypeError || error instanceof RangeError) {
    return new ExpenseServiceError("invalid_data", "The expense details are invalid.");
  }
  return new ExpenseServiceError("unexpected", "The expense operation failed. Please try again.", source);
}

function isSupabaseLikeError(error: unknown): error is SupabaseLikeError {
  return !(error instanceof Error) && typeof error === "object" && error !== null && (
    "code" in error || "message" in error || "details" in error || "hint" in error
  );
}

function isNetworkError(error: Error): boolean {
  return /network|fetch|offline|connection|timeout/i.test(error.message);
}
