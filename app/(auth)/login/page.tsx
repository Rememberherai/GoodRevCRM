'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, CheckCircle, Fingerprint } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { isWebAuthnSupported } from '@/lib/webauthn';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [passkeyEmail, setPasskeyEmail] = useState('');
  const [showPasskeyEmail, setShowPasskeyEmail] = useState(false);
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlError = searchParams.get('error');
  const next = searchParams.get('next') ?? '/projects';

  const [supabase] = useState(() => createClient());

  useEffect(() => {
    setWebAuthnSupported(isWebAuthnSupported());
  }, []);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsEmailLoading(true);
    setError(null);

    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      setMagicLinkSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send magic link';
      setError(message);
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setIsEmailLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      router.push(next);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      if (message.includes('Email not confirmed')) {
        setError('Please check your email and confirm your account before signing in.');
      } else if (message.includes('Invalid login credentials')) {
        setError('Invalid email or password. If you signed up with Google, use the Google button below.');
      } else {
        setError(message);
      }
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handlePasskeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passkeyEmail.trim()) return;

    setIsPasskeyLoading(true);
    setError(null);

    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');

      const optionsRes = await fetch('/api/auth/webauthn/authenticate/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: passkeyEmail.trim() }),
      });

      if (!optionsRes.ok) {
        const err = await optionsRes.json();
        throw new Error(err.error ?? 'Failed to get passkey options');
      }

      const options = await optionsRes.json();
      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch('/api/auth/webauthn/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertion, email: passkeyEmail.trim() }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error ?? 'Passkey verification failed');
      }

      const { callbackUrl } = await verifyRes.json();
      // Append next param to callbackUrl
      const url = new URL(callbackUrl, window.location.origin);
      url.searchParams.set('next', next);
      window.location.href = url.toString();
    } catch (err: unknown) {
      // NotAllowedError means user cancelled/dismissed the biometric prompt
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setShowPasskeyEmail(false);
      } else {
        const message = err instanceof Error ? err.message : 'Passkey sign in failed';
        setError(message);
      }
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('Login error:', error);
      setIsGoogleLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
          <CardDescription>
            We sent a magic link to <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-muted-foreground">
            Click the link in the email to sign in. It may take a minute to arrive.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setMagicLinkSent(false);
              setEmail('');
            }}
          >
            Use a different email
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">GoodRev CRM</CardTitle>
        <CardDescription>
          Sign in to access your research CRM
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(urlError || error) && (
          <Alert variant="destructive">
            <AlertDescription>
              {error
                ? error
                : urlError === 'auth_callback_error'
                  ? 'There was a problem signing you in. Please try again.'
                  : decodeURIComponent(urlError || 'An error occurred. Please try again.')}
            </AlertDescription>
          </Alert>
        )}

        {/* Passkey / fingerprint login */}
        {webAuthnSupported && (
          <>
            {showPasskeyEmail ? (
              <form onSubmit={handlePasskeyLogin} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="passkeyEmail">Your email</Label>
                  <Input
                    id="passkeyEmail"
                    type="email"
                    placeholder="you@example.com"
                    value={passkeyEmail}
                    onChange={(e) => setPasskeyEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isPasskeyLoading} className="flex-1">
                    {isPasskeyLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Waiting...</>
                    ) : (
                      <><Fingerprint className="mr-2 h-4 w-4" />Continue</>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowPasskeyEmail(false); setPasskeyEmail(''); setError(null); }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={() => { setShowPasskeyEmail(true); setError(null); }}
              >
                <Fingerprint className="mr-2 h-4 w-4" />
                Sign in with passkey
              </Button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>
          </>
        )}


        <form onSubmit={showPassword ? handlePasswordLogin : handleMagicLink} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {showPassword && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={isEmailLoading}
            className="w-full"
            size="lg"
          >
            {isEmailLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {showPassword ? 'Signing in...' : 'Sending link...'}
              </>
            ) : showPassword ? (
              'Sign in'
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send magic link
              </>
            )}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setShowPassword(!showPassword);
            setError(null);
          }}
          className="w-full text-xs text-center text-muted-foreground hover:text-foreground transition-colors"
        >
          {showPassword ? 'Use magic link instead' : 'Or use password'}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
          variant="outline"
          className="w-full"
          size="lg"
        >
          {isGoogleLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <GoogleIcon className="mr-2 h-4 w-4" />
              Continue with Google
            </>
          )}
        </Button>

        <p className="text-sm text-center text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            href={`/signup${next !== '/projects' ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="text-foreground hover:underline font-medium"
          >
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function LoginFormSkeleton() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <Skeleton className="h-8 w-32 mx-auto mb-2" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-4 w-64 mx-auto" />
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
