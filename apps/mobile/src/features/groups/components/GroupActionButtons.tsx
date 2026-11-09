import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactElement } from "react";
import { dashboardColors } from "@/features/dashboard/theme";

export function GroupActionButtons({
  onAddExpense,
  onSettleUp,
}: {
  onAddExpense: () => void;
  onSettleUp: () => void;
}): ReactElement {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        onPress={onAddExpense}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
      >
        <Text style={styles.primaryText}>+ Add Expense</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onSettleUp}
        style={({ pressed }) => [
          styles.secondary,
          pressed && styles.secondaryPressed,
        ]}
      >
        <Text style={styles.secondaryText}>Settle Up</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", gap: 10 },
  primary: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: dashboardColors.primary,
  },
  pressed: { backgroundColor: dashboardColors.primaryActive },
  primaryText: { color: dashboardColors.surface, fontWeight: "700" },
  secondary: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: dashboardColors.primary,
    borderRadius: 8,
    backgroundColor: dashboardColors.surface,
  },
  secondaryPressed: { backgroundColor: dashboardColors.subtle },
  secondaryText: { color: dashboardColors.primaryActive, fontWeight: "700" },
});
