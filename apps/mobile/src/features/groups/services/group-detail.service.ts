import { calculateGroupBalances } from "@/services/balances/balance.service";
import { fetchGroupExpenses } from "@/services/expenses/expense.repository";
import { assertValidUuid } from "@/services/expenses/expense.validation";
import { fetchUserGroups } from "@/services/groups/group.service";
import { fetchGroupPaymentHistory } from "@/services/settlements/settlement.service";
import { supabase } from "@/utils/supabase";
import type { Database } from "@/types/database.types";
import type { GroupDetail, GroupMember } from "@/features/groups/types/group-detail.types";

type MemberRow = Database["public"]["Tables"]["group_members"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export async function fetchGroupDetail(
  groupId: string,
  userId: string,
): Promise<GroupDetail> {
  assertValidUuid(groupId, "group ID");
  assertValidUuid(userId, "user ID");

  const userGroups = await fetchUserGroups(userId);
  const selected = userGroups.find(({ group }) => group.id === groupId);
  if (!selected) throw new Error("This group could not be found or accessed.");

  const [{ data: memberData, error: memberError }, profilesResult, expenses, payments, balanceResult] =
    await Promise.all([
      supabase.from("group_members").select("*").eq("group_id", groupId).eq("status", "active"),
      supabase.from("profiles").select("*"),
      fetchGroupExpenses(groupId, { includeVoided: true }),
      fetchGroupPaymentHistory(groupId),
      calculateGroupBalances(groupId),
    ]);
  if (memberError) throw memberError;
  if (profilesResult.error) throw profilesResult.error;

  const members = memberData as unknown as MemberRow[];
  const profiles = profilesResult.data as unknown as ProfileRow[];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const balanceByUserId = new Map(balanceResult.balances.map((entry) => [entry.userId, entry.balance]));

  const groupMembers: GroupMember[] = members.map((member) => {
    const profile = profileById.get(member.user_id);
    return {
      id: member.user_id,
      name: profile?.full_name?.trim() || "Group member",
      avatarUrl: profile?.avatar_url ?? null,
      role: member.role,
      balance: balanceByUserId.get(member.user_id) ?? 0,
    };
  });

  return {
    group: selected.group,
    members: groupMembers,
    expenses,
    payments,
    totalExpensesPaise: expenses
      .filter((expense) => expense.core.status !== "voided" && expense.core.status !== "cancelled")
      .reduce((total, expense) => total + expense.core.totalAmount, 0),
    userBalancePaise: balanceByUserId.get(userId) ?? 0,
  };
}
