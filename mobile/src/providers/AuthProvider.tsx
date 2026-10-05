/**
 * Session provider.
 *
 * Wraps the Supabase session so the app can restore a persisted sign-in on
 * launch and react to sign-in / sign-out without every screen wiring up its
 * own listener.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/googleAuth';
import type { GoogleSignInResult } from '@/lib/googleAuth';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<GoogleSignInResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let active = true;

    // Restore the persisted session (AsyncStorage) so a returning user lands
    // straight in the shop instead of the login screen.
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(readableAuthError(error.message));
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(readableAuthError(error.message));
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Google sign-in reuses the same Supabase project and provider as the
  // website, so it resolves to the same user id and therefore the same cart.
  // The session is stored by the shared Supabase client, so it persists and
  // refreshes exactly like an email/password session.
  const googleSignIn = useCallback(async () => {
    if (!isSupabaseConfigured) throw new Error('Sign-in is not configured yet.');
    return signInWithGoogle();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      configured: isSupabaseConfigured,
      signIn,
      signUp,
      signInWithGoogle: googleSignIn,
      signOut,
    }),
    [user, session, isLoading, signIn, signUp, googleSignIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

/** Turn Supabase's raw auth messages into something a customer can act on. */
function readableAuthError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) {
    return 'That email and password do not match an account. Check them and try again.';
  }
  if (text.includes('email not confirmed')) {
    return 'Confirm your email address first, then sign in.';
  }
  if (text.includes('user already registered')) {
    return 'An account already exists for that email. Sign in instead.';
  }
  if (text.includes('password should be at least')) {
    return 'Choose a password with at least 6 characters.';
  }
  if (text.includes('failed to fetch') || text.includes('network')) {
    return 'Could not reach the sign-in service. Check your connection.';
  }
  return message;
}