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

  const supabase = createClient();

  useEffect(() => {
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
        supabase
          .from('users')
          .select('is_system_admin')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            setState((prev) => ({ ...prev, isSystemAdmin: data?.is_system_admin ?? false }));
          });
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
        isSystemAdmin: session?.user ? prev.isSystemAdmin : false,
      }));

      // Fetch admin status in background without blocking auth flow
      if (session?.user) {
        supabase
          .from('users')
          .select('is_system_admin')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            setState((prev) => ({ ...prev, isSystemAdmin: data?.is_system_admin ?? false }));
          });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase.auth]);

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
  }, [supabase.auth]);

  const signInWithMagicLink = useCallback(async (email: string, emailRedirectTo?: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: emailRedirectTo || `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      throw error;
    }
  }, [supabase.auth]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  }, [supabase.auth]);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
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
  }, [supabase.auth]);

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
  };
}
