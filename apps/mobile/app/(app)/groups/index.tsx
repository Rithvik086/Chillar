import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, type ReactElement } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { GroupList } from "@/features/dashboard/components/GroupList";
import { dashboardColors } from "@/features/dashboard/theme";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";
import { BottomNav } from "@/shared/navigation/BottomNav";

export default function GroupsScreen(): ReactElement {
  const { user } = useAuth();
  const router = useRouter();
  const { data, error, isLoading, refresh } = useDashboard(user?.id);
  const [search, setSearch] = useState("");
  const visibleGroups = data?.groups.filter(({ group }) =>
    group.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  ) ?? [];
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Groups</Text>
            <Text style={styles.subtitle}>{data?.groups.length ?? 0} groups</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push("/(app)/groups/create")} style={styles.create}>
            <Text style={styles.createText}>Create Group</Text>
          </Pressable>
        </View>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search groups" placeholderTextColor={dashboardColors.muted} style={styles.search} />
        {isLoading ? <ActivityIndicator color={dashboardColors.primary} /> : null}
        {error ? <Pressable onPress={refresh}><Text style={styles.error}>{error} Retry</Text></Pressable> : null}
        {data ? <GroupList groups={visibleGroups} onGroupPress={(groupId) => router.push({ pathname: "/(app)/groups/[groupId]", params: { groupId } })} onCreate={() => router.push("/(app)/groups/create")} /> : null}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dashboardColors.background },
  content: { padding: 16, paddingBottom: 92, gap: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { color: dashboardColors.text, fontSize: 28, fontWeight: "700" },
  subtitle: { color: dashboardColors.secondary, fontSize: 15, marginTop: 2 },
  create: { minHeight: 42, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: dashboardColors.primary },
  createText: { color: dashboardColors.surface, fontSize: 13, fontWeight: "700" },
  search: { minHeight: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: dashboardColors.border, borderRadius: 8, color: dashboardColors.text, backgroundColor: dashboardColors.surface, marginBottom: 4 },
  error: { color: dashboardColors.negative, paddingVertical: 12 },
});
