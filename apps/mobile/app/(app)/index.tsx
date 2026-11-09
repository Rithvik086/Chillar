import { Link } from "expo-router";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { ReactElement } from "react";
import { useAuth } from "../../src/auth/AuthProvider";

export default function AppHomeScreen(): ReactElement {
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "Chillar user";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>CHILLAR</Text>
        <Text style={styles.title}>Welcome, {String(displayName)}</Text>
        <Text style={styles.subtitle}>Your authenticated app shell is ready.</Text>
        <Link href="/(app)/groups" style={styles.link}>Groups placeholder</Link>
        <Link href="/(app)/profile" style={styles.link}>Profile</Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { flex: 1, padding: 24, justifyContent: "center", gap: 16 },
  eyebrow: { color: "#2563eb", fontSize: 13, fontWeight: "700", letterSpacing: 1.5 },
  title: { color: "#0f172a", fontSize: 28, fontWeight: "700" },
  subtitle: { color: "#475569", fontSize: 16 },
  link: { color: "#2563eb", fontSize: 16, fontWeight: "600" },
});
