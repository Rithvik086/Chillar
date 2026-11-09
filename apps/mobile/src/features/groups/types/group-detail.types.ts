import type { Database } from "@/types/database.types";
import type { ExpenseReadModel } from "@/services/expenses/expense.types";

export type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

export interface GroupMember {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  balance: number;
}

export interface GroupActivity {
  id: string;
  kind: "expense" | "settlement";
  description: string;
  detail: string;
  date: string;
  amountPaise: number;
  impactPaise: number | null;
  voided: boolean;
}

export interface GroupDetail {
  group: GroupRow;
  members: GroupMember[];
  expenses: ExpenseReadModel[];
  payments: PaymentRow[];
  totalExpensesPaise: number;
  userBalancePaise: number;
}
