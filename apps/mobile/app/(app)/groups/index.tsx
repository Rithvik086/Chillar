import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactElement } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { GroupList } from "@/features/dashboard/components/GroupList";
import { dashboardColors } from "@/features/dashboard/theme";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";
import { BottomNav } from "@/shared/navigation/BottomNav";

export default function GroupsScreen(): ReactElement {
  const { user } = useAuth();
  const router = useRouter();
  const { data, error, isLoading, refresh } = useDashboard(user?.id);
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Groups</Text>
        <Text style={styles.subtitle}>Your shared expense groups</Text>
        {isLoading ? <ActivityIndicator color={dashboardColors.primary} /> : null}
        {error ? <Pressable onPress={refresh}><Text style={styles.error}>{error} Retry</Text></Pressable> : null}
        {data ? <GroupList groups={data.groups} onGroupPress={(groupId) => router.push({ pathname: "/(app)/groups/[groupId]", params: { groupId } })} /> : null}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dashboardColors.background },
  content: { padding: 16, paddingBottom: 92, gap: 8 },
  title: { color: dashboardColors.text, fontSize: 28, fontWeight: "700" },
  subtitle: { color: dashboardColors.secondary, fontSize: 16, marginBottom: 8 },
  error: { color: dashboardColors.negative, paddingVertical: 12 },
});
