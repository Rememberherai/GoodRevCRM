'use client';

import { useState } from 'react';
import { CheckCircle2, QrCode, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface SearchResult {
  id: string;
  registrant_name: string;
  registrant_email: string;
  status: string;
  checked_in_at: string | null;
}

interface CheckInResult {
  registration_id: string;
  registrant_name: string;
  checked_in_at: string;
}

interface EventCheckInTabProps {
  projectSlug: string;
  eventId: string;
}

export function EventCheckInTab({ projectSlug, eventId }: EventCheckInTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<CheckInResult | null>(null);

  const apiBase = `/api/projects/${projectSlug}/events/${eventId}`;

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setLastCheckIn(null);
    try {
      const res = await fetch(`${apiBase}/registrations?search=${encodeURIComponent(searchQuery.trim())}&limit=10`);
      const data = await res.json();
      if (res.ok) setSearchResults(data.registrations ?? []);
    } catch {
      console.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleCheckIn(registrationId: string) {
    setIsCheckingIn(true);
    try {
      const res = await fetch(`${apiBase}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: registrationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-in failed');

      setLastCheckIn({
        registration_id: data.registration?.id ?? registrationId,
        registrant_name: data.registration?.registrant_name ?? 'Guest',
        checked_in_at: data.registration?.checked_in_at ?? new Date().toISOString(),
      });
      toast.success('Checked in successfully');

      // Refresh search results
      setSearchResults(prev =>
        prev.map(r => r.id === registrationId ? { ...r, checked_in_at: new Date().toISOString() } : r)
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setIsCheckingIn(false);
    }
  }

  async function handleQrCheckIn(e: React.FormEvent) {
    e.preventDefault();
    if (!qrCode.trim()) return;

    setIsCheckingIn(true);
    setLastCheckIn(null);
    try {
      const res = await fetch(`${apiBase}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code: qrCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-in failed');

      setLastCheckIn({
        registration_id: data.registration?.id ?? '',
        registrant_name: data.registration?.registrant_name ?? 'Guest',
        checked_in_at: data.registration?.checked_in_at ?? new Date().toISOString(),
      });
      toast.success('Checked in successfully');
      setQrCode('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setIsCheckingIn(false);
    }
  }

  return (
    <div className="space-y-4">
      {lastCheckIn && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="font-semibold text-green-800 dark:text-green-200">{lastCheckIn.registrant_name}</p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Checked in at {new Date(lastCheckIn.checked_in_at).toLocaleTimeString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />Search & Check In
            </CardTitle>
            <CardDescription>Look up a registration by name or email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <Button type="submit" variant="secondary" size="sm" disabled={isSearching}>
                Search
              </Button>
            </form>

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map(reg => (
                  <div key={reg.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                    <div>
                      <p className="font-medium">{reg.registrant_name}</p>
                      <p className="text-xs text-muted-foreground">{reg.registrant_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{reg.status.replace(/_/g, ' ')}</Badge>
                      {reg.checked_in_at ? (
                        <Badge variant="outline" className="text-green-700">Checked in</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={isCheckingIn || reg.status === 'cancelled' || reg.status === 'waitlisted'}
                          onClick={() => handleCheckIn(reg.id)}
                        >
                          Check In
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4" />QR Code Check-In
            </CardTitle>
            <CardDescription>Enter or scan a QR code to check in.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleQrCheckIn} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="qr-input">QR Code</Label>
                <Input
                  id="qr-input"
                  placeholder="Paste or scan QR code..."
                  value={qrCode}
                  onChange={e => setQrCode(e.target.value)}
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={isCheckingIn || !qrCode.trim()}>
                {isCheckingIn ? 'Checking in...' : 'Check In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
