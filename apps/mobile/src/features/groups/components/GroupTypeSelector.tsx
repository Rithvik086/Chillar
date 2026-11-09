import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactElement } from "react";
import { dashboardColors } from "@/features/dashboard/theme";
import type { GroupType } from "@/features/groups/types/group.types";

const groupTypes: GroupType[] = ["Trip", "Home", "Couple", "Friends", "Family", "Other"];

export function GroupTypeSelector({ value, onChange }: { value: GroupType; onChange: (value: GroupType) => void }): ReactElement {
  return (
    <View style={styles.container}>
      {groupTypes.map((type) => (
        <Pressable key={type} accessibilityRole="button" accessibilityState={{ selected: value === type }} onPress={() => onChange(type)} style={[styles.option, value === type && styles.selected]}>
          <Text style={[styles.text, value === type && styles.selectedText]}>{type}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { minHeight: 40, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: dashboardColors.border, borderRadius: 20, backgroundColor: dashboardColors.surface },
  selected: { borderColor: dashboardColors.primary, backgroundColor: "#DBEAFE" },
  text: { color: dashboardColors.secondary, fontSize: 13, fontWeight: "600" },
  selectedText: { color: dashboardColors.primaryActive },
});
