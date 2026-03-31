'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isSystemAdmin: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isSystemAdmin: false,
  });

  const [supabase] = useState(() => createClient());

  useEffect(() => {
    const fetchAdminStatus = (userId: string) => {
      Promise.resolve(
        supabase
          .from('users')
          .select('is_system_admin')
          .eq('id', userId)
          .single()
      ).then(({ data }) => {
        setState((prev) => (
          prev.user?.id === userId
            ? { ...prev, isSystemAdmin: data?.is_system_admin ?? false }
            : prev
        ));
      }).catch(() => {
        console.error('Failed to fetch admin status');
        setState((prev) => (
          prev.user?.id === userId
            ? { ...prev, isSystemAdmin: false }
            : prev
        ));
      });
    };

    // Get initial session — set auth state immediately, fetch admin status in background
    const getInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setState({
        user: session?.user ?? null,
        session,
        isLoading: false,
        isSystemAdmin: false,
      });

      // Fetch admin status in background without blocking auth
      if (session?.user) {
        fetchAdminStatus(session.user.id);
      }
    };

    getInitialSession();

    // Listen for auth changes — set auth state synchronously, fetch admin status in background
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((prev) => ({
        user: session?.user ?? null,
        session,
        isLoading: false,
        isSystemAdmin: session?.user && prev.user?.id === session.user.id ? prev.isSystemAdmin : false,
      }));

      // Fetch admin status in background without blocking auth flow
      if (session?.user) {
        fetchAdminStatus(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw error;
    }
  }, [supabase]);

  const signInWithMagicLink = useCallback(async (email: string, emailRedirectTo?: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: emailRedirectTo || `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      throw error;
    }
  }, [supabase]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      throw error;
    }
  }, [supabase]);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: fullName ? { full_name: fullName } : undefined,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      throw error;
    }
    return data;
  }, [supabase]);

  // Passkey (WebAuthn) login — orchestrates the full flow client-side.
  // Returns the callbackUrl to navigate to, or throws on failure.
  const signInWithPasskey = useCallback(async (email: string): Promise<string> => {
    const { startAuthentication } = await import('@simplewebauthn/browser');
    const normalizedEmail = email.trim();

    // 1. Get authentication options from server
    const optionsRes = await fetch('/api/auth/webauthn/authenticate/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail }),
    });

    if (!optionsRes.ok) {
      const err = await optionsRes.json();
      throw new Error(err.error ?? 'Failed to get authentication options');
    }

    const options = await optionsRes.json();

    // 2. Trigger biometric prompt in browser
    const assertion = await startAuthentication({ optionsJSON: options });

    // 3. Verify with server and get callbackUrl
    const verifyRes = await fetch('/api/auth/webauthn/authenticate/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: assertion, email: normalizedEmail }),
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json();
      throw new Error(err.error ?? 'Passkey verification failed');
    }

    const { callbackUrl } = await verifyRes.json();
    return callbackUrl;
  }, []);

  return {
    user: state.user,
    session: state.session,
    isLoading: state.isLoading,
    isAuthenticated: !!state.user,
    isSystemAdmin: state.isSystemAdmin,
    signOut,
    signInWithGoogle,
    signInWithMagicLink,
    signInWithEmail,
    signUp,
    signInWithPasskey,
  };
}
