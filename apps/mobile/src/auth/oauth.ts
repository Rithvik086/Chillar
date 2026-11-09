import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase";

const callbackExchanges = new Map<string, Promise<Session>>();

export async function exchangeOAuthCallback(url: string): Promise<Session> {
  const callback = Linking.parse(url);
  const callbackError = callback.queryParams?.error_description ?? callback.queryParams?.error;
  if (callbackError) throw new Error(String(callbackError));

  const code = callback.queryParams?.code;
  if (typeof code !== "string" || code.length === 0) {
    throw new Error("Google sign-in returned no authorization code.");
  }

  const existingExchange = callbackExchanges.get(code);
  if (existingExchange) return existingExchange;

  const exchange = supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
    if (error) throw error;
    if (!data.session) throw new Error("Google sign-in returned no session.");
    return data.session;
  });
  callbackExchanges.set(code, exchange);
  return exchange;
}
