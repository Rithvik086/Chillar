import type { Database } from "@/types/database.types";

export type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
export type GroupType = "Trip" | "Home" | "Couple" | "Friends" | "Family" | "Other";

export interface CreateGroupInput {
  name: string;
  description?: string;
  type: GroupType;
}

export interface CreateGroupResult {
  group: GroupRow;
  groupType: GroupType;
}
