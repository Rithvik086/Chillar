import { StyleSheet, Text, View } from "react-native";
import type { ReactElement } from "react";
import type { DashboardActivity } from "@/features/dashboard/types/dashboard.types";
import { dashboardColors } from "@/features/dashboard/theme";
import { formatDate, formatRupees } from "@/features/dashboard/utils/dashboard.formatters";

export function RecentActivity({
  activities,
}: {
  activities: readonly DashboardActivity[];
}): ReactElement {
  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>Recent Activity</Text>
      </View>
      {activities.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.meta}>
            Your recent expenses and settlements will appear here.
          </Text>
        </View>
      ) : (
        activities.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.icon}>
              <Text style={styles.iconText}>₹</Text>
            </View>
            <View style={styles.main}>
              <Text style={styles.activityTitle}>{item.description}</Text>
              <Text style={styles.meta}>
                {item.detail} · {item.groupName}
              </Text>
              <Text style={styles.meta}>{formatDate(item.date)}</Text>
            </View>
            <Text
              style={[
                styles.amount,
                {
                  color:
                    item.amount >= 0
                      ? dashboardColors.positive
                      : dashboardColors.negative,
                },
              ]}
            >
              {formatRupees(item.amount, true)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  heading: { marginTop: 8, marginBottom: 4 },
  title: { color: dashboardColors.text, fontSize: 20, fontWeight: "700" },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: dashboardColors.border,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: dashboardColors.subtle,
  },
  iconText: { color: dashboardColors.text, fontWeight: "700" },
  main: { flex: 1, marginLeft: 10 },
  activityTitle: {
    color: dashboardColors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  meta: { color: dashboardColors.muted, fontSize: 12, marginTop: 3 },
  amount: { fontSize: 15, fontWeight: "700", marginLeft: 8 },
  empty: {
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: dashboardColors.border,
    borderRadius: 8,
    backgroundColor: dashboardColors.surface,
  },
});
