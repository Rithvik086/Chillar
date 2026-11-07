import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './src/utils/supabase';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = AuthSession.makeRedirectUri({
  scheme: 'chillar',
  path: 'auth/callback',
});

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession }, error }) => {
        if (error) {
          throw error;
        }
        if (isMounted) {
          setSession(currentSession);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setErrorMessage(`Unable to restore your session: ${getErrorMessage(error)}`);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    setErrorMessage(null);
    setIsSigningIn(true);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        throw error;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'cancel' || result.type === 'dismiss') {
        return;
      }
      if (result.type !== 'success') {
        throw new Error('Google sign-in did not complete.');
      }

      const callback = Linking.parse(result.url);
      const callbackError = callback.queryParams?.error_description ?? callback.queryParams?.error;
      if (callbackError) {
        throw new Error(String(callbackError));
      }

      const code = callback.queryParams?.code;
      if (typeof code !== 'string' || code.length === 0) {
        throw new Error('Google sign-in returned no authorization code.');
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        throw exchangeError;
      }
    } catch (error: unknown) {
      setErrorMessage(`Google sign-in failed: ${getErrorMessage(error)}`);
    } finally {
      setIsSigningIn(false);
    }
  };

  const signOut = async () => {
    setErrorMessage(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage(`Unable to log out: ${error.message}`);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  const displayName =
    session?.user.user_metadata?.full_name ??
    session?.user.user_metadata?.name ??
    'Chillar user';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.card}>
        <Text style={styles.title}>Chillar</Text>
        {session ? (
          <>
            <Text style={styles.heading}>Welcome, {String(displayName)}</Text>
            <Text style={styles.email}>{session.user.email ?? 'No email available'}</Text>
            <Button title="Log out" onPress={signOut} />
          </>
        ) : (
          <>
            <Text style={styles.heading}>Welcome to Chillar</Text>
            <Text style={styles.subtitle}>Sign in to continue.</Text>
            <Button
              title={isSigningIn ? 'Signing in...' : 'Continue with Google'}
              onPress={signInWithGoogle}
              disabled={isSigningIn}
            />
          </>
        )}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  title: {
    color: '#2563eb',
    fontSize: 36,
    fontWeight: '700',
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    color: '#475569',
    fontSize: 16,
  },
  email: {
    color: '#475569',
    fontSize: 16,
  },
  error: {
    color: '#b91c1c',
    maxWidth: 340,
    textAlign: 'center',
  },
});