'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Fingerprint, Trash2, Plus, Monitor } from 'lucide-react';
import { isWebAuthnSupported } from '@/lib/webauthn';

interface PasskeyCredential {
  id: string;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
}

export function PasskeyManager() {
  const [credentials, setCredentials] = useState<PasskeyCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [webAuthnSupported, setWebAuthnSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setWebAuthnSupported(isWebAuthnSupported());
  }, []);

  const fetchCredentials = useCallback(async () => {
    if (webAuthnSupported !== true) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/webauthn/credentials');
      if (res.ok) {
        const data = await res.json();
        setCredentials(data);
      }
    } catch (err) {
      console.error('Failed to fetch credentials:', err);
    } finally {
      setIsLoading(false);
    }
  }, [webAuthnSupported]);

  useEffect(() => {
    if (webAuthnSupported === null) return;
    void fetchCredentials();
  }, [fetchCredentials, webAuthnSupported]);

  const handleRegister = async () => {
    if (!deviceName.trim()) return;

    setIsRegistering(true);
    setError(null);
    setSuccess(null);

    try {
      // Get registration options
      const optionsRes = await fetch('/api/auth/webauthn/register/options', {
        method: 'POST',
      });

      if (!optionsRes.ok) {
        const err = await optionsRes.json();
        throw new Error(err.error ?? 'Failed to get registration options');
      }

      const options = await optionsRes.json();

      // Trigger biometric prompt (dynamic import avoids SSR issues)
      const { startRegistration } = await import('@simplewebauthn/browser');
      const registration = await startRegistration({ optionsJSON: options });

      // Verify and store
      const verifyRes = await fetch('/api/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: registration, deviceName: deviceName.trim() }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error ?? 'Registration failed');
      }

      setSuccess('Passkey registered successfully.');
      setDeviceName('');
      setShowNameInput(false);
      await fetchCredentials();
    } catch (err: unknown) {
      // NotAllowedError means the user cancelled/dismissed the biometric prompt
      if (err instanceof Error && err.name === 'NotAllowedError') {
        // No error shown — user intentionally dismissed
      } else {
        const message = err instanceof Error ? err.message : 'Registration failed';
        setError(message);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDelete = async (credentialId: string) => {
    setDeletingId(credentialId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/auth/webauthn/credentials/${credentialId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to delete passkey');
      }

      setSuccess('Passkey removed.');
      setCredentials((prev) => prev.filter((c) => c.id !== credentialId));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete passkey';
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  if (webAuthnSupported === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Passkeys
          </CardTitle>
          <CardDescription>
            Checking passkey support...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!webAuthnSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Passkeys
          </CardTitle>
          <CardDescription>
            Your browser doesn&apos;t support passkeys. Try a modern browser like Chrome, Safari, or Edge.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5" />
          Passkeys
        </CardTitle>
        <CardDescription>
          Sign in with your fingerprint, Face ID, or device PIN. No password needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Registered passkeys */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading passkeys...
          </div>
        ) : credentials.length === 0 ? (
          <p className="text-sm text-muted-foreground">No passkeys registered yet.</p>
        ) : (
          <div className="space-y-2">
            {credentials.map((cred) => (
              <div
                key={cred.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{cred.device_name ?? 'Passkey'}</p>
                    <p className="text-xs text-muted-foreground">
                      Added {new Date(cred.created_at).toLocaleDateString()}
                      {cred.last_used_at && (
                        <> · Last used {new Date(cred.last_used_at).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(cred.id)}
                  disabled={deletingId === cred.id}
                  className="text-destructive hover:text-destructive"
                >
                  {deletingId === cred.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add passkey */}
        {showNameInput ? (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="space-y-2">
              <Label htmlFor="deviceName">Name this passkey</Label>
              <Input
                id="deviceName"
                placeholder="e.g. Work MacBook, iPhone"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleRegister(); }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRegister}
                disabled={isRegistering || !deviceName.trim()}
                size="sm"
              >
                {isRegistering ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registering...</>
                ) : (
                  <><Fingerprint className="mr-2 h-4 w-4" />Register passkey</>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowNameInput(false); setDeviceName(''); setError(null); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => { setShowNameInput(true); setSuccess(null); setError(null); }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add passkey
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
