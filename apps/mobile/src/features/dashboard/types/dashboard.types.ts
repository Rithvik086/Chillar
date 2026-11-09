import type { Database } from "../../../types/database.types";
import type { UserGroup } from "../../../services/groups/group.service";

export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

export interface DashboardGroup extends UserGroup {
  balance: number;
  lastActivityAt: string | null;
}

export interface DashboardActivity {
  id: string;
  description: string;
  groupName: string;
  detail: string;
  date: string;
  amount: number;
}

export interface DashboardData {
  groups: DashboardGroup[];
  activities: DashboardActivity[];
  balance: number;
  owe: number;
  owed: number;
}
