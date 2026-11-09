import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, type ReactElement } from "react";
import { exchangeOAuthCallback } from "@/auth/oauth";

export default function OAuthCallbackScreen(): ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const callbackUrl = buildCallbackUrl(params);
    exchangeOAuthCallback(callbackUrl)
      .then(() => router.replace("/(app)"))
      .catch((error: unknown) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Google sign-in could not be completed.",
        );
      });
  }, [params.code, params.error, params.error_description, router]);

  return (
    <SafeAreaView style={styles.container}>
      {errorMessage ? (
        <Text style={styles.error}>{errorMessage}</Text>
      ) : (
        <ActivityIndicator size="large" color="#2563eb" />
      )}
    </SafeAreaView>
  );
}

function buildCallbackUrl(params: {
  code?: string;
  error?: string;
  error_description?: string;
}): string {
  const query = new URLSearchParams();
  if (params.code) query.set("code", params.code);
  if (params.error) query.set("error", params.error);
  if (params.error_description)
    query.set("error_description", params.error_description);
  return `chillar://auth/callback${query.size > 0 ? `?${query.toString()}` : ""}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    padding: 24,
  },
  error: { color: "#b91c1c", textAlign: "center" },
});
