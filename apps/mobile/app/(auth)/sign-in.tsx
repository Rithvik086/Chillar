import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { ReactElement } from "react";
import { useAuth } from "../../src/auth/AuthProvider";

export default function SignInScreen(): ReactElement {
  const { clearError, errorMessage, isSigningIn, signInWithGoogle } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.title}>Chillar</Text>
        <Text style={styles.heading}>Split expenses, stay even.</Text>
        <Text style={styles.subtitle}>Sign in to share expenses with your groups.</Text>
        <Pressable
          accessibilityRole="button"
          disabled={isSigningIn}
          onPress={signInWithGoogle}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, isSigningIn && styles.buttonDisabled]}
        >
          {isSigningIn ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Continue with Google</Text>}
        </Pressable>
        {errorMessage ? (
          <Pressable onPress={clearError}>
            <Text style={styles.error}>{errorMessage}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  title: { color: "#2563eb", fontSize: 42, fontWeight: "700" },
  heading: { color: "#0f172a", fontSize: 24, fontWeight: "700", textAlign: "center" },
  subtitle: { color: "#475569", fontSize: 16, textAlign: "center" },
  button: { minWidth: 240, alignItems: "center", borderRadius: 12, backgroundColor: "#2563eb", paddingHorizontal: 20, paddingVertical: 14 },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  error: { color: "#b91c1c", maxWidth: 340, textAlign: "center" },
});
