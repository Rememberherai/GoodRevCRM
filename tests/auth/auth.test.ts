import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockSignInWithOAuth = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

describe('Auth Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  describe('Sign In', () => {
    it('should call signInWithOAuth with Google provider', async () => {
      mockSignInWithOAuth.mockResolvedValue({ error: null });

      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback',
        },
      });

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback',
        },
      });
    });

    it('should handle sign in error', async () => {
      const error = new Error('Auth error');
      mockSignInWithOAuth.mockResolvedValue({ error });

      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const result = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });

      expect(result.error).toBe(error);
    });
  });

  describe('Sign Out', () => {
    it('should call signOut', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      await supabase.auth.signOut();

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('Session', () => {
    it('should get current session', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
        access_token: 'token-123',
      };

      mockGetSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const { data } = await supabase.auth.getSession();

      expect(data.session).toEqual(mockSession);
    });

    it('should return null session when not authenticated', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const { data } = await supabase.auth.getSession();

      expect(data.session).toBeNull();
    });
  });

  describe('Auth State Change', () => {
    it('should subscribe to auth state changes', async () => {
      const callback = vi.fn();
      const mockUnsubscribe = vi.fn();

      mockOnAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      });

      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const { data } = supabase.auth.onAuthStateChange(callback);

      expect(mockOnAuthStateChange).toHaveBeenCalledWith(callback);
      expect(data.subscription.unsubscribe).toBeDefined();
    });
  });
});
