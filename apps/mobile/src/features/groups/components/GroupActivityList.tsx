import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactElement } from "react";
import { dashboardColors } from "@/features/dashboard/theme";
import {
  formatDate,
  formatRupees,
} from "@/features/dashboard/utils/dashboard.formatters";
import type { GroupActivity } from "@/features/groups/types/group-detail.types";

type Filter = "all" | "expense" | "settlement";

export function GroupActivityList({
  activities,
  filter,
  onFilterChange,
}: {
  activities: readonly GroupActivity[];
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
}): ReactElement {
  const visible = activities.filter(
    (activity) => filter === "all" || activity.kind === filter,
  );
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Activity</Text>
      <View style={styles.filters}>
        {(["all", "expense", "settlement"] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => onFilterChange(value)}
            style={[styles.filter, filter === value && styles.activeFilter]}
          >
            <Text
              style={[
                styles.filterText,
                filter === value && styles.activeFilterText,
              ]}
            >
              {value === "all"
                ? "All"
                : value === "expense"
                  ? "Expenses"
                  : "Settlements"}
            </Text>
          </Pressable>
        ))}
      </View>
      {visible.length === 0 ? (
        <Text style={styles.empty}>No activity in this view yet.</Text>
      ) : (
        visible.map((activity) => (
          <View
            key={activity.id}
            style={[styles.row, activity.voided && styles.voided]}
          >
            <View style={styles.icon}>
              <Text>{activity.kind === "expense" ? "₹" : "↔"}</Text>
            </View>
            <View style={styles.main}>
              <Text style={styles.description}>{activity.description}</Text>
              <Text style={styles.meta}>
                {activity.detail} · {formatDate(activity.date)}
                {activity.voided
                  ? " · Voided"
                  : activity.kind === "settlement" &&
                      activity.impactPaise === null
                    ? " · Pending"
                    : ""}
              </Text>
            </View>
            <View style={styles.amount}>
              <Text style={styles.total}>
                {formatRupees(activity.amountPaise)}
              </Text>
              {activity.impactPaise !== null ? (
                <Text
                  style={[
                    styles.impact,
                    {
                      color:
                        activity.impactPaise >= 0
                          ? dashboardColors.positive
                          : dashboardColors.negative,
                    },
                  ]}
                >
                  {activity.impactPaise >= 0 ? "+" : "-"}
                  {formatRupees(Math.abs(activity.impactPaise))}
                </Text>
              ) : null}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  title: { color: dashboardColors.text, fontSize: 19, fontWeight: "700" },
  filters: { flexDirection: "row", gap: 7 },
  filter: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: dashboardColors.subtle,
  },
  activeFilter: { backgroundColor: "#DBEAFE" },
  filterText: {
    color: dashboardColors.secondary,
    fontSize: 12,
    fontWeight: "600",
  },
  activeFilterText: { color: dashboardColors.primaryActive },
  row: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderWidth: 1,
    borderColor: dashboardColors.border,
    borderRadius: 8,
    backgroundColor: dashboardColors.surface,
  },
  voided: { opacity: 0.65 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: dashboardColors.subtle,
  },
  main: { flex: 1, marginHorizontal: 10 },
  description: { color: dashboardColors.text, fontWeight: "700" },
  meta: { color: dashboardColors.muted, fontSize: 11, marginTop: 4 },
  amount: { alignItems: "flex-end" },
  total: { color: dashboardColors.text, fontSize: 13, fontWeight: "700" },
  impact: { fontSize: 11, marginTop: 3 },
  empty: { color: dashboardColors.secondary, paddingVertical: 12 },
});
