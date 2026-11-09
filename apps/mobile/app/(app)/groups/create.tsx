import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactElement } from "react";
import { CreateGroupForm } from "@/features/groups/components/CreateGroupForm";
import { dashboardColors } from "@/features/dashboard/theme";

export default function CreateGroupScreen(): ReactElement {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="button" onPress={() => router.back()} style={styles.back}>‹ Back</Text>
        <Text style={styles.title}>Create Group</Text>
        <Text style={styles.subtitle}>Set up a shared space for expenses.</Text>
        <CreateGroupForm onCancel={() => router.back()} onSuccess={(groupId) => router.replace({ pathname: "/(app)/groups/[groupId]", params: { groupId, created: "true" } })} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dashboardColors.background },
  content: { padding: 16, gap: 8, paddingBottom: 32 },
  back: { color: dashboardColors.primary, fontSize: 15, fontWeight: "700", marginBottom: 8 },
  title: { color: dashboardColors.text, fontSize: 28, fontWeight: "700" },
  subtitle: { color: dashboardColors.secondary, fontSize: 15, marginBottom: 20 },
});
