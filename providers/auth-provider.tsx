'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSystemAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  isSystemAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const fetchAdminStatus = async (userId: string) => {
      const { data } = await supabase
        .from('users')
        .select('is_system_admin')
        .eq('id', userId)
        .single();
      return data?.is_system_admin ?? false;
    };

    // Get initial session
    const getInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const adminStatus = await fetchAdminStatus(session.user.id);
        setIsSystemAdmin(adminStatus);
      }
      setIsLoading(false);
    };

    getInitialSession();

    // Listen for auth changes — set auth state synchronously, fetch admin status in background
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setIsSystemAdmin(false);
      }
      setIsLoading(false);

      // Fetch admin status in background without blocking auth flow
      if (session?.user) {
        fetchAdminStatus(session.user.id).then(setIsSystemAdmin);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user,
        isSystemAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
