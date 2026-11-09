import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren, type ReactElement } from "react";
import { supabase } from "../utils/supabase";
import { exchangeOAuthCallback } from "./oauth";

WebBrowser.maybeCompleteAuthSession();

const redirectTo = AuthSession.makeRedirectUri({
  scheme: "chillar",
  path: "auth/callback",
});

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isSigningIn: boolean;
  errorMessage: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function AuthProvider({ children }: PropsWithChildren): ReactElement {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) setSession(nextSession);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession }, error }) => {
        if (error) throw error;
        if (isMounted) setSession(currentSession);
      })
      .catch((error: unknown) => {
        if (isMounted) setErrorMessage(`Unable to restore your session: ${getErrorMessage(error)}`);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    isLoading,
    isSigningIn,
    errorMessage,
    clearError: () => setErrorMessage(null),
    signInWithGoogle: async () => {
      setErrorMessage(null);
      setIsSigningIn(true);
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error) throw error;

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === "cancel" || result.type === "dismiss") return;
        if (result.type !== "success") throw new Error("Google sign-in did not complete.");

        await exchangeOAuthCallback(result.url);
      } catch (error: unknown) {
        setErrorMessage(`Google sign-in failed: ${getErrorMessage(error)}`);
      } finally {
        setIsSigningIn(false);
      }
    },
    signOut: async () => {
      setErrorMessage(null);
      const { error } = await supabase.auth.signOut();
      if (error) setErrorMessage(`Unable to log out: ${error.message}`);
    },
  }), [errorMessage, isLoading, isSigningIn, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
