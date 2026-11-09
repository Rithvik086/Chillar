import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactElement } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader";
import { BalanceSummary } from "@/features/dashboard/components/BalanceSummary";
import { GroupList } from "@/features/dashboard/components/GroupList";
import { RecentActivity } from "@/features/dashboard/components/RecentActivity";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";
import { dashboardColors } from "@/features/dashboard/theme";
import { firstName } from "@/features/dashboard/utils/dashboard.formatters";
import { BottomNav } from "@/shared/navigation/BottomNav";

export default function AppHomeScreen(): ReactElement {
  const { user } = useAuth();
  const router = useRouter();
  const displayName = String(
    user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "there",
  );
  const { data, error, isLoading, isRefreshing, refresh } = useDashboard(
    user?.id,
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <DashboardHeader displayName={displayName} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={dashboardColors.primary}
          />
        }
      >
        <View style={styles.welcome}>
          <Text style={styles.brand}>Chillar</Text>
          <Text style={styles.greeting}>
            Good morning, {firstName(displayName)}!
          </Text>
        </View>
        {isLoading ? (
          <View style={styles.state}>
            <ActivityIndicator color={dashboardColors.primary} />
            <Text style={styles.stateText}>Loading your balances...</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
            <Text
              onPress={refresh}
              accessibilityRole="button"
              style={styles.retry}
            >
              Retry
            </Text>
          </View>
        ) : null}
        {!isLoading && !error && data ? (
          <>
            <BalanceSummary
              balance={data.balance}
              owe={data.owe}
              owed={data.owed}
            />
            <GroupList
              groups={data.groups}
              onGroupPress={(groupId) =>
                router.push({
                  pathname: "/(app)/groups/[groupId]",
                  params: { groupId },
                })
              }
              onCreate={() => router.push("/(app)/groups")}
            />
            <RecentActivity activities={data.activities} />
          </>
        ) : null}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dashboardColors.background },
  content: { padding: 16, paddingBottom: 92, gap: 12 },
  welcome: { paddingVertical: 4 },
  brand: { color: dashboardColors.text, fontSize: 20, fontWeight: "700" },
  greeting: { color: dashboardColors.secondary, fontSize: 16, marginTop: 2 },
  state: { alignItems: "center", paddingVertical: 48, gap: 10 },
  stateText: { color: dashboardColors.secondary },
  error: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: { color: dashboardColors.negative, fontSize: 14 },
  retry: { color: dashboardColors.primary, fontWeight: "700", marginTop: 8 },
});
