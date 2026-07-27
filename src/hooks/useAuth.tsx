import { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { createSessionFromUrl, signInWithGoogle as performGoogleSignIn } from "../lib/oauth";

interface AuthContextValue {
  session: Session | null;
  initializing: boolean;
  sendOtp: (phone: string) => Promise<{ error: string | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Google sign-in can come back into the app via a cold deep link (the OS
  // hands the angel:// URL to the app directly) rather than through the
  // WebBrowser.openAuthSessionAsync() promise — mainly on Android. Catch
  // that path too so a session is created either way.
  const incomingUrl = Linking.useLinkingURL();
  useEffect(() => {
    if (!incomingUrl) return;
    createSessionFromUrl(incomingUrl).catch((err) => {
      console.warn("[auth] failed to create session from deep link", err);
    });
  }, [incomingUrl]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      initializing,
      sendOtp: async (phone: string) => {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        return { error: error?.message ?? null };
      },
      verifyOtp: async (phone: string, token: string) => {
        const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
        return { error: error?.message ?? null };
      },
      signInWithGoogle: async () => {
        try {
          // performGoogleSignIn resolves to WebBrowserAuthSessionResult:
          // 'success' | 'cancel' | 'dismiss' | 'locked' | 'opened'. Only
          // 'success' carries a URL to turn into a session; the rest are
          // the user backing out, not failures — errors instead throw
          // (from signInWithOAuth or createSessionFromUrl) and land below.
          await performGoogleSignIn();
          return { error: null };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Google sign-in failed" };
        }
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
