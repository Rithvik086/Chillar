import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { ReactElement } from "react";
import { AuthGate } from "@/auth/AuthGate";
import { AuthProvider } from "@/auth/AuthProvider";

export default function RootLayout(): ReactElement {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
