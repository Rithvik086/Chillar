import { StyleSheet, Text, View } from "react-native";
import type { ReactElement } from "react";
import { dashboardColors } from "@/features/dashboard/theme";
import { formatRupees } from "@/features/dashboard/utils/dashboard.formatters";

export function BalanceSummary({
  balance,
  owe,
  owed,
}: {
  balance: number;
  owe: number;
  owed: number;
}): ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>TOTAL BALANCE</Text>
      <Text
        style={[
          styles.total,
          {
            color:
              balance >= 0
                ? dashboardColors.positive
                : dashboardColors.negative,
          },
        ]}
      >
        {formatRupees(balance, true)}
      </Text>
      <Text style={styles.summary}>
        {balance >= 0 ? "Overall you are owed" : "Overall you owe"}
      </Text>
      <View style={styles.breakdown}>
        <View>
          <Text style={styles.label}>You owe</Text>
          <Text style={[styles.amount, { color: dashboardColors.negative }]}>
            {formatRupees(owe)}
          </Text>
        </View>
        <View>
          <Text style={styles.label}>You're owed</Text>
          <Text style={[styles.amount, { color: dashboardColors.positive }]}>
            {formatRupees(owed)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: dashboardColors.border,
    backgroundColor: dashboardColors.surface,
  },
  eyebrow: {
    color: dashboardColors.secondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  total: { fontSize: 30, fontWeight: "800", marginTop: 4 },
  summary: {
    color: dashboardColors.secondary,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 2,
  },
  breakdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: dashboardColors.border,
  },
  label: { color: dashboardColors.secondary, fontSize: 14 },
  amount: { fontSize: 20, fontWeight: "700", marginTop: 5 },
});
