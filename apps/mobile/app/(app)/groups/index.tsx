import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactElement } from "react";

export default function GroupsScreen(): ReactElement {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Groups</Text>
        <Text style={styles.subtitle}>
          Group functionality will be added in a later phase.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { color: "#0f172a", fontSize: 28, fontWeight: "700" },
  subtitle: { color: "#475569", fontSize: 16 },
});
