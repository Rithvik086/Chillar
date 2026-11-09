import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { ReactElement } from "react";
import { useAuth } from "./AuthProvider";

export function AuthGate(): ReactElement {
  const { isLoading, session } = useAuth();
  const segments = useSegments();
  const inAuthGroup = segments[0] === "(auth)";
  const inAppGroup = segments[0] === "(app)";
  const isOAuthCallback = segments[0] === "auth";

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!session && !inAuthGroup && !isOAuthCallback) return <Redirect href="/(auth)/sign-in" />;
  if (session && !inAppGroup) return <Redirect href="/(app)" />;

  return <Stack />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
});
