import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactElement } from "react";
import { dashboardColors } from "@/features/dashboard/theme";
import { initials } from "@/features/dashboard/utils/dashboard.formatters";

export function GroupHeader({
  name,
  memberCount,
  onBack,
  onOptions,
}: {
  name: string;
  memberCount: number;
  onBack: () => void;
  onOptions: () => void;
}): ReactElement {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        style={styles.iconButton}
      >
        <Text style={styles.icon}>‹</Text>
      </Pressable>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(name).slice(0, 2)}</Text>
      </View>
      <View style={styles.title}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.meta}>
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Group options"
        onPress={onOptions}
        style={styles.iconButton}
      >
        <Text style={styles.options}>•••</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: dashboardColors.border,
    backgroundColor: dashboardColors.surface,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { color: dashboardColors.text, fontSize: 34, lineHeight: 34 },
  options: { color: dashboardColors.secondary, fontSize: 18, letterSpacing: 2 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
  },
  avatarText: { color: dashboardColors.primaryActive, fontWeight: "700" },
  title: { flex: 1 },
  name: { color: dashboardColors.text, fontSize: 18, fontWeight: "700" },
  meta: { color: dashboardColors.secondary, fontSize: 13, marginTop: 2 },
});
