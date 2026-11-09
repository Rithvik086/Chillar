import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactElement } from "react";
import { dashboardColors } from "../theme";
import type { DashboardGroup } from "../types/dashboard.types";
import { GroupListItem } from "./GroupListItem";

export function GroupList({
  groups,
  onGroupPress,
  onCreate,
  onJoin,
}: {
  groups: readonly DashboardGroup[];
  onGroupPress: (groupId: string) => void;
  onCreate: () => void;
  onJoin?: () => void;
}): ReactElement {
  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>Your Groups</Text>
        <Pressable accessibilityRole="button" onPress={onCreate}>
          <Text style={styles.action}>Create Group</Text>
        </Pressable>
      </View>
      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptyText}>
            Create a group or join one to start sharing expenses.
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCreate}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Create Group</Text>
            </Pressable>
            {onJoin ? (
              <Pressable
                accessibilityRole="button"
                onPress={onJoin}
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>Join Group</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        groups.map((group) => (
          <GroupListItem
            key={group.group.id}
            item={group}
            onPress={() => onGroupPress(group.group.id)}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  title: { color: dashboardColors.text, fontSize: 20, fontWeight: "700" },
  action: { color: dashboardColors.primary, fontSize: 13, fontWeight: "700" },
  empty: {
    padding: 16,
    borderWidth: 1,
    borderColor: dashboardColors.border,
    borderRadius: 8,
    backgroundColor: dashboardColors.surface,
  },
  emptyTitle: { color: dashboardColors.text, fontSize: 16, fontWeight: "700" },
  emptyText: {
    color: dashboardColors.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  primary: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: dashboardColors.primary,
  },
  primaryText: {
    color: dashboardColors.surface,
    fontWeight: "700",
    fontSize: 13,
  },
  secondary: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: dashboardColors.border,
  },
  secondaryText: {
    color: dashboardColors.primaryActive,
    fontWeight: "700",
    fontSize: 13,
  },
});
