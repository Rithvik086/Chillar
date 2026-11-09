import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactElement } from "react";
import { dashboardColors } from "@/features/dashboard/theme";
import { initials } from "@/features/dashboard/utils/dashboard.formatters";

export function DashboardHeader({
  displayName,
}: {
  displayName: string;
}): ReactElement {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>₹</Text>
        </View>
        <Text style={styles.headerTitle}>Home</Text>
      </View>
      <Link href="/(app)/profile" asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initials(displayName)}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: dashboardColors.border,
    backgroundColor: dashboardColors.background,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: dashboardColors.primary,
  },
  brandMarkText: {
    color: dashboardColors.surface,
    fontSize: 18,
    fontWeight: "700",
  },
  headerTitle: { color: dashboardColors.text, fontSize: 18, fontWeight: "700" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: dashboardColors.primary,
  },
  avatarText: {
    color: dashboardColors.surface,
    fontSize: 12,
    fontWeight: "700",
  },
});
