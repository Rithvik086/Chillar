import { Stack } from "expo-router";
import type { ReactElement } from "react";

export default function AppLayout(): ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
