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
    // Get initial session
    const getInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      let isSystemAdmin = false;
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('is_system_admin')
          .eq('id', session.user.id)
          .single();
        isSystemAdmin = data?.is_system_admin ?? false;
      }

      setState({
        user: session?.user ?? null,
        session,
        isLoading: false,
        isSystemAdmin,
      });
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      let isSystemAdmin = false;
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('is_system_admin')
          .eq('id', session.user.id)
          .single();
        isSystemAdmin = data?.is_system_admin ?? false;
      }

      setState({
        user: session?.user ?? null,
        session,
        isLoading: false,
        isSystemAdmin,
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase.auth]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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

  return {
    user: state.user,
    session: state.session,
    isLoading: state.isLoading,
    isAuthenticated: !!state.user,
    isSystemAdmin: state.isSystemAdmin,
    signOut,
    signInWithGoogle,
  };
}
