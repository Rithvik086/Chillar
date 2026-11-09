import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactElement } from "react";
import { dashboardColors } from "../../features/dashboard/theme";

export function BottomNav(): ReactElement {
  return (
    <View style={styles.nav}>
      <Link href="/(app)" asChild>
        <Pressable accessibilityRole="button" style={styles.item}>
          <Text style={styles.icon}>⌂</Text>
          <Text style={styles.active}>Home</Text>
        </Pressable>
      </Link>
      <Link href="/(app)/groups" asChild>
        <Pressable accessibilityRole="button" style={styles.item}>
          <Text style={styles.icon}>♧</Text>
          <Text style={styles.label}>Groups</Text>
        </Pressable>
      </Link>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        style={styles.item}
      >
        <Text style={styles.icon}>▤</Text>
        <Text style={styles.label}>Activity</Text>
      </Pressable>
      <Link href="/(app)/profile" asChild>
        <Pressable accessibilityRole="button" style={styles.item}>
          <Text style={styles.icon}>◎</Text>
          <Text style={styles.label}>Profile</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: dashboardColors.border,
    backgroundColor: dashboardColors.surface,
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
    gap: 2,
  },
  icon: { color: dashboardColors.text, fontSize: 22 },
  active: { color: dashboardColors.primary, fontSize: 12, fontWeight: "700" },
  label: { color: dashboardColors.secondary, fontSize: 12 },
});
