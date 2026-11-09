import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactElement } from "react";
import type { DashboardGroup } from "@/features/dashboard/types/dashboard.types";
import { dashboardColors } from "@/features/dashboard/theme";
import {
  formatRupees,
  initials,
  relativeActivityDate,
} from "@/features/dashboard/utils/dashboard.formatters";

export function GroupListItem({
  item,
  onPress,
}: {
  item: DashboardGroup;
  onPress: () => void;
}): ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.group.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {initials(item.group.name).slice(0, 2)}
        </Text>
      </View>
      <View style={styles.main}>
        <Text style={styles.name}>{item.group.name}</Text>
        <Text style={styles.meta}>
          {item.memberCount} members ·{" "}
          {relativeActivityDate(item.lastActivityAt)}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.meta}>
          {item.balance >= 0 ? "You're owed" : "You owe"}
        </Text>
        <Text
          style={[
            styles.amount,
            {
              color:
                item.balance >= 0
                  ? dashboardColors.positive
                  : dashboardColors.negative,
            },
          ]}
        >
          {formatRupees(Math.abs(item.balance))}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderWidth: 1,
    borderColor: dashboardColors.border,
    borderRadius: 8,
    backgroundColor: dashboardColors.surface,
  },
  pressed: { backgroundColor: dashboardColors.subtle },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
  },
  badgeText: {
    color: dashboardColors.primaryActive,
    fontWeight: "700",
    fontSize: 12,
  },
  main: { flex: 1, marginLeft: 10 },
  name: { color: dashboardColors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: dashboardColors.muted, fontSize: 12, marginTop: 3 },
  right: { alignItems: "flex-end" },
  amount: { fontSize: 15, fontWeight: "700", marginTop: 3 },
});
