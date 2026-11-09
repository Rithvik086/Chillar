import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactElement } from "react";
import { useAuth } from "./AuthProvider";

export function AuthGate(): ReactElement {
  const { isLoading, session } = useAuth();
  const segments = useSegments();
  const inAuthGroup = segments[0] === "(auth)";
  const inAppGroup = segments[0] === "(app)";
  const isOAuthCallback = segments[0] === "auth";

  if (isLoading) {
    return <SafeAreaView style={styles.loading}>
      <View style={styles.loadingContent}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    </SafeAreaView>;
  }

  if (!session && !inAuthGroup && !isOAuthCallback) return <Redirect href="/(auth)/sign-in" />;
  if (session && !inAppGroup) return <Redirect href="/(app)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
