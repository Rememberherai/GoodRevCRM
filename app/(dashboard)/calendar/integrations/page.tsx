'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RefreshCw, Trash2, ExternalLink, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface CalendarIntegration {
  id: string;
  provider: string;
  email: string;
  calendar_id: string;
  is_primary: boolean | null;
  sync_enabled: boolean | null;
  push_enabled: boolean | null;
  last_synced_at: string | null;
  initial_sync_done: boolean | null;
  sync_errors_count: number | null;
  last_sync_error: string | null;
  status: string;
  created_at: string;
}

export default function CalendarIntegrationsPage() {
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadIntegrations = async () => {
    try {
      const res = await fetch('/api/calendar/integrations');
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations || []);
      } else {
        setError('Failed to load integrations');
      }
    } catch {
      setError('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntegrations();

    // Check for connection success/error in URL
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get('error');
    if (params.get('connected') === 'true') {
      setSuccessMessage('Calendar connected successfully!');
    } else if (urlError) {
      setError(urlError === 'access_denied' ? 'Calendar access was denied' : `Connection failed: ${urlError}`);
    }
    if (params.get('connected') === 'true' || urlError) {
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnect = () => {
    window.location.href = '/api/calendar/integrations/google/connect';
  };

  const handleToggle = async (id: string, field: 'sync_enabled' | 'push_enabled', value: boolean) => {
    setError(null);
    try {
      const res = await fetch(`/api/calendar/integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        setIntegrations((prev) =>
          prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
        );
      } else {
        setError('Failed to update setting');
      }
    } catch {
      setError('Failed to update setting');
    }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    setError(null);
    try {
      // Trigger sync via direct API (not cron)
      const res = await fetch(`/api/calendar/integrations/${id}/sync`, { method: 'POST' });
      if (res.ok) {
        await loadIntegrations();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Sync failed');
      }
    } catch {
      setError('Sync failed — please try again');
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm('Disconnect this calendar? All synced events will be removed.')) return;
    setDeleting(id);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/integrations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setIntegrations((prev) => prev.filter((i) => i.id !== id));
      } else {
        setError('Failed to disconnect calendar');
      }
    } catch {
      setError('Failed to disconnect calendar');
    } finally {
      setDeleting(null);
    }
  };

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar Integrations</h1>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-md">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-auto text-green-600 hover:text-green-800"
            aria-label="Dismiss success message"
          >
            &times;
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-destructive hover:text-destructive/80"
            aria-label="Dismiss error message"
          >
            &times;
          </button>
        </div>
      )}

      {/* Connect button */}
      {integrations.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connect Google Calendar</CardTitle>
            <CardDescription>
              Sync your Google Calendar to block busy times on your booking page and
              automatically add new bookings to your calendar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={handleConnect}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Google Calendar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connected integrations */}
      {integrations.map((integration) => (
        <Card key={integration.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle className="text-base">{integration.email}</CardTitle>
                  <CardDescription>Google Calendar</CardDescription>
                </div>
              </div>
              <StatusBadge status={integration.status} errCount={integration.sync_errors_count} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sync status */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Last synced: {formatLastSync(integration.last_synced_at)}
            </div>

            {/* Error display */}
            {integration.last_sync_error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{integration.last_sync_error}</span>
              </div>
            )}

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor={`sync-${integration.id}`} className="text-sm">
                  Sync events (block busy times)
                </Label>
                <Switch
                  id={`sync-${integration.id}`}
                  checked={integration.sync_enabled ?? false}
                  onCheckedChange={(val) => handleToggle(integration.id, 'sync_enabled', val)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor={`push-${integration.id}`} className="text-sm">
                  Add bookings to calendar
                </Label>
                <Switch
                  id={`push-${integration.id}`}
                  checked={integration.push_enabled ?? false}
                  onCheckedChange={(val) => handleToggle(integration.id, 'push_enabled', val)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSync(integration.id)}
                disabled={syncing === integration.id || deleting === integration.id}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${syncing === integration.id ? 'animate-spin' : ''}`} />
                {syncing === integration.id ? 'Syncing...' : 'Sync Now'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleDisconnect(integration.id)}
                disabled={deleting === integration.id || syncing === integration.id}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting === integration.id ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Add another */}
      {integrations.length > 0 && (
        <Button type="button" variant="outline" onClick={handleConnect}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Connect Another Calendar
        </Button>
      )}
    </div>
  );
}

function StatusBadge({ status, errCount }: { status: string; errCount: number | null }) {
  const errors = errCount ?? 0;
  if (status === 'connected' && errors === 0) {
    return (
      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
      </Badge>
    );
  }
  if (status === 'error' || errors > 0) {
    return (
      <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
        <AlertCircle className="h-3 w-3 mr-1" /> {errors > 5 ? 'Errors' : 'Warning'}
      </Badge>
    );
  }
  if (status === 'expired') {
    return (
      <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
        <AlertCircle className="h-3 w-3 mr-1" /> Expired
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-gray-700 border-gray-300">
      {status}
    </Badge>
  );
}
