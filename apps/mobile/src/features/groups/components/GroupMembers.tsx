import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactElement } from "react";
import { dashboardColors } from "@/features/dashboard/theme";
import {
  formatRupees,
  initials,
} from "@/features/dashboard/utils/dashboard.formatters";
import type { GroupMember } from "@/features/groups/types/group-detail.types";

export function GroupMembers({
  members,
  onViewAll,
}: {
  members: readonly GroupMember[];
  onViewAll?: () => void;
}): ReactElement {
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text style={styles.title}>Members</Text>
        {onViewAll ? (
          <Pressable onPress={onViewAll}>
            <Text style={styles.link}>View all</Text>
          </Pressable>
        ) : null}
      </View>
      {members.slice(0, 5).map((member) => (
        <View key={member.id} style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {initials(member.name).slice(0, 2)}
            </Text>
          </View>
          <View style={styles.name}>
            <Text style={styles.memberName}>{member.name}</Text>
            {member.role === "admin" ? (
              <Text style={styles.role}>Admin</Text>
            ) : null}
          </View>
          <Text
            style={[
              styles.balance,
              {
                color:
                  member.balance >= 0
                    ? dashboardColors.positive
                    : dashboardColors.negative,
              },
            ]}
          >
            {member.balance === 0
              ? "Settled"
              : `${member.balance > 0 ? "+" : "-"}${formatRupees(Math.abs(member.balance))}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { color: dashboardColors.text, fontSize: 19, fontWeight: "700" },
  link: { color: dashboardColors.primary, fontSize: 13, fontWeight: "700" },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    padding: 9,
    borderWidth: 1,
    borderColor: dashboardColors.border,
    borderRadius: 8,
    backgroundColor: dashboardColors.surface,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: dashboardColors.subtle,
  },
  avatarText: {
    color: dashboardColors.secondary,
    fontSize: 12,
    fontWeight: "700",
  },
  name: { flex: 1, marginLeft: 10 },
  memberName: { color: dashboardColors.text, fontWeight: "600" },
  role: { color: dashboardColors.muted, fontSize: 11, marginTop: 2 },
  balance: { fontSize: 13, fontWeight: "700" },
});
