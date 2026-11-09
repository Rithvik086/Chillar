import { supabase } from "../../utils/supabase";
import type { Database } from "../../types/database.types";

type GroupRow = Database["public"]["Tables"]["groups"]["Row"];
type GroupMemberRow = Database["public"]["Tables"]["group_members"]["Row"];

export interface UserGroup {
  group: GroupRow;
  memberCount: number;
}

export async function fetchUserGroups(userId: string): Promise<UserGroup[]> {
  const { data: membershipData, error: membershipError } = await supabase
    .from("group_members")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active");
  if (membershipError) throw membershipError;

  const memberships = membershipData as unknown as GroupMemberRow[];
  if (memberships.length === 0) return [];

  const groupIds = memberships.map(({ group_id }) => group_id);
  const [{ data: groupData, error: groupError }, { data: memberData, error: memberError }] =
    await Promise.all([
      supabase.from("groups").select("*").in("id", groupIds),
      supabase.from("group_members").select("*").in("group_id", groupIds).eq("status", "active"),
    ]);
  if (groupError) throw groupError;
  if (memberError) throw memberError;

  const groups = groupData as unknown as GroupRow[];
  const members = memberData as unknown as GroupMemberRow[];
  return groups.map((group) => ({
    group,
    memberCount: members.filter((member) => member.group_id === group.id).length,
  }));
}
