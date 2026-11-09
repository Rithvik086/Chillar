import { StyleSheet, Text, View } from "react-native";
import type { ReactElement } from "react";
import { dashboardColors } from "@/features/dashboard/theme";
import { formatRupees } from "@/features/dashboard/utils/dashboard.formatters";

export function GroupBalanceSummary({
  totalExpensesPaise,
  balancePaise,
}: {
  totalExpensesPaise: number;
  balancePaise: number;
}): ReactElement {
  const owed = balancePaise >= 0;
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Total group expenses</Text>
      <Text style={styles.total}>{formatRupees(totalExpensesPaise)}</Text>
      <View style={styles.divider} />
      <Text style={styles.label}>{owed ? "You're owed" : "You owe"}</Text>
      <Text
        style={[
          styles.balance,
          { color: owed ? dashboardColors.positive : dashboardColors.negative },
        ]}
      >
        {formatRupees(Math.abs(balancePaise))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: dashboardColors.border,
    borderRadius: 10,
    backgroundColor: dashboardColors.surface,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  label: { color: dashboardColors.secondary, fontSize: 13, fontWeight: "600" },
  total: {
    color: dashboardColors.text,
    fontSize: 27,
    fontWeight: "700",
    marginTop: 5,
  },
  divider: {
    height: 1,
    backgroundColor: dashboardColors.border,
    marginVertical: 14,
  },
  balance: { fontSize: 22, fontWeight: "700", marginTop: 5 },
});
