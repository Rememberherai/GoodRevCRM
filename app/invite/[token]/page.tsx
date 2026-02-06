'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock, Users } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface InvitationData {
  id: string;
  email: string;
  full_email: string;
  role: string;
  expires_at: string;
  created_at: string;
  is_expired: boolean;
  is_accepted: boolean;
  project: {
    id: string;
    name: string;
    slug: string;
  };
  inviter: {
    full_name: string;
  };
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch invitation details
        const inviteRes = await fetch(`/api/invitations/${token}`);
        if (!inviteRes.ok) {
          const data = await inviteRes.json();
          setError(data.error || 'Invalid invitation');
          setLoading(false);
          return;
        }
        const inviteData = await inviteRes.json();
        setInvitation(inviteData);

        // Check if user is logged in
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (err) {
        console.error('Error loading invitation:', err);
        setError('Failed to load invitation');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [token]);

  const handleSignIn = () => {
    // Redirect to login with this page as the return URL
    router.push(`/login?next=/invite/${token}`);
  };

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to accept invitation');
        setAccepting(false);
        return;
      }

      // Success - redirect to the project
      if (invitation?.project?.slug) {
        router.push(`/projects/${invitation.project.slug}`);
      } else {
        router.push('/projects');
      }
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setError('Failed to accept invitation');
      setAccepting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid or not found
  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              {error || 'This invitation link is invalid or has been removed.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/login')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired invitation
  if (invitation.is_expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Invitation Expired</CardTitle>
            <CardDescription>
              This invitation has expired. Please ask the project administrator to send a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/login')} variant="outline" className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already accepted
  if (invitation.is_accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Already Accepted</CardTitle>
            <CardDescription>
              This invitation has already been accepted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(`/projects/${invitation.project.slug}`)} className="w-full">
              Go to Project
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if email matches (when logged in)
  const emailMismatch = user && user.email?.toLowerCase() !== invitation.full_email.toLowerCase();

  // Valid invitation
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>You&apos;re Invited!</CardTitle>
          <CardDescription>
            {invitation.inviter.full_name} has invited you to join
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Project info */}
          <div className="rounded-lg border p-4 text-center">
            <h3 className="font-semibold text-lg">{invitation.project.name}</h3>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">Role:</span>
              <Badge variant="secondary" className="capitalize">
                {invitation.role}
              </Badge>
            </div>
          </div>

          {/* Invitation details */}
          <div className="text-sm text-muted-foreground text-center">
            <p>Invitation sent to: <span className="font-medium text-foreground">{invitation.email}</span></p>
            <p className="mt-1">
              Expires: {new Date(invitation.expires_at).toLocaleDateString()}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Email mismatch warning */}
          {emailMismatch && (
            <Alert>
              <AlertDescription>
                You&apos;re signed in as <span className="font-medium">{user?.email}</span>, but this invitation was sent to a different email address. Please sign in with the correct account.
              </AlertDescription>
            </Alert>
          )}

          {/* Action buttons */}
          {!user ? (
            <div className="space-y-3">
              <Button onClick={handleSignIn} className="w-full" size="lg">
                Sign in to Accept
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Sign in with the email address this invitation was sent to
              </p>
            </div>
          ) : emailMismatch ? (
            <div className="space-y-3">
              <Button onClick={handleSignIn} variant="outline" className="w-full">
                Sign in with Different Account
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full"
              size="lg"
            >
              {accepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                'Accept Invitation'
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
