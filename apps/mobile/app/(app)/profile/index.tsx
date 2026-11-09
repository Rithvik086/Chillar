import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactElement } from "react";
import { useAuth } from "@/auth/AuthProvider";

export default function ProfileScreen(): ReactElement {
  const { signOut, user } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.email}>{user?.email ?? "No email available"}</Text>
        <Pressable onPress={signOut} style={styles.button}>
          <Text style={styles.buttonText}>Log out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  title: { color: "#0f172a", fontSize: 28, fontWeight: "700" },
  email: { color: "#475569", fontSize: 16 },
  button: {
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#0f172a",
    padding: 14,
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
});
