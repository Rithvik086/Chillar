import { Paise } from "../money/money";

export interface ExpensePayer {
  userId: string;
  amountPaid: Paise;
}

export interface ExpenseSplit {
  userId: string;
  amountOwed: Paise;
}

export interface Expense {
  id: string;
  groupId?: string;
  totalAmount: Paise;
  currency: "INR";
  payers: readonly ExpensePayer[];
  splits: readonly ExpenseSplit[];
  status?: "active" | "voided" | "cancelled";
}

export interface EqualSplitParticipant {
  userId: string;
}

export interface ExactSplitAllocation {
  userId: string;
  amount: Paise;
}

export interface PercentageSplitAllocation {
  userId: string;
  percentage: number | string;
}

export interface ShareSplitAllocation {
  userId: string;
  shares: number;
}
