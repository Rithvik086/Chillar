import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, type ReactElement } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
import { dashboardColors } from "@/features/dashboard/theme";
import { GroupActionButtons } from "@/features/groups/components/GroupActionButtons";
import { GroupActivityList } from "@/features/groups/components/GroupActivityList";
import { GroupBalanceSummary } from "@/features/groups/components/GroupBalanceSummary";
import { GroupHeader } from "@/features/groups/components/GroupHeader";
import { GroupMembers } from "@/features/groups/components/GroupMembers";
import { useGroupDetail } from "@/features/groups/hooks/useGroupDetail";
import { buildGroupActivities } from "@/features/groups/utils/group-detail";

export default function GroupDetailScreen(): ReactElement {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const groupId = Array.isArray(params.groupId)
    ? params.groupId[0]
    : params.groupId;
  const { data, error, isLoading, refresh } = useGroupDetail(groupId, user?.id);
  const [filter, setFilter] = useState<"all" | "expense" | "settlement">("all");

  if (isLoading) {
    return (
      <StateScreen>
        <ActivityIndicator color={dashboardColors.primary} />
        <Text style={styles.stateText}>Loading group...</Text>
      </StateScreen>
    );
  }
  if (error || !data) {
    return (
      <StateScreen>
        <Text style={styles.errorTitle}>Group unavailable</Text>
        <Text style={styles.stateText}>
          {error ?? "This group could not be loaded."}
        </Text>
        <Text
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.link}
        >
          Go back
        </Text>
      </StateScreen>
    );
  }

  const activities = buildGroupActivities(
    data.expenses,
    data.payments,
    user?.id ?? "",
  );
  return (
    <SafeAreaView style={styles.safeArea}>
      <GroupHeader
        name={data.group.name}
        memberCount={data.members.length}
        onBack={() => router.back()}
        onOptions={() =>
          Alert.alert(
            "Group options",
            "Group management options will be available in a later phase.",
          )
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refresh}
            tintColor={dashboardColors.primary}
          />
        }
      >
        <GroupBalanceSummary
          totalExpensesPaise={data.totalExpensesPaise}
          balancePaise={data.userBalancePaise}
        />
        <GroupActionButtons
          onAddExpense={() =>
            Alert.alert(
              "Add Expense",
              "The group-specific expense form will be connected in the next phase.",
            )
          }
          onSettleUp={() =>
            Alert.alert(
              "Settle Up",
              "The group-specific settlement form will be connected in the next phase.",
            )
          }
        />
        <GroupMembers
          members={data.members}
          onViewAll={
            data.members.length > 5
              ? () =>
                  Alert.alert(
                    "Members",
                    `${data.members.length} active members are in this group.`,
                  )
              : undefined
          }
        />
        {data.expenses.length === 0 && data.payments.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              Ready for your first shared expense?
            </Text>
            <Text style={styles.emptyText}>
              Add an expense to start tracking who paid and who owes.
            </Text>
            <Text
              accessibilityRole="button"
              onPress={() =>
                Alert.alert(
                  "Add Expense",
                  "The group-specific expense form will be connected in the next phase.",
                )
              }
              style={styles.link}
            >
              Add your first expense
            </Text>
          </View>
        ) : null}
        <GroupActivityList
          activities={activities}
          filter={filter}
          onFilterChange={setFilter}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function StateScreen({
  children,
}: {
  children: ReactElement | ReactElement[];
}): ReactElement {
  return (
    <SafeAreaView style={styles.state}>
      <View style={styles.stateContent}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: dashboardColors.background },
  content: { padding: 16, gap: 16, paddingBottom: 28 },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: dashboardColors.background,
  },
  stateContent: { alignItems: "center", gap: 10, maxWidth: 320 },
  stateText: {
    color: dashboardColors.secondary,
    textAlign: "center",
    lineHeight: 20,
  },
  errorTitle: { color: dashboardColors.text, fontSize: 20, fontWeight: "700" },
  link: {
    color: dashboardColors.primary,
    fontWeight: "700",
    paddingVertical: 6,
  },
  empty: {
    padding: 16,
    borderWidth: 1,
    borderColor: dashboardColors.border,
    borderRadius: 10,
    backgroundColor: dashboardColors.surface,
    gap: 6,
  },
  emptyTitle: { color: dashboardColors.text, fontSize: 16, fontWeight: "700" },
  emptyText: { color: dashboardColors.secondary, lineHeight: 20 },
});
