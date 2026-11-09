import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactElement } from "react";

export default function AppLayout(): ReactElement {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
