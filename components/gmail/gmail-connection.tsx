'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Mail, Plus, Trash2, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { CONNECTION_STATUS_COLORS, CONNECTION_STATUS_LABELS, type GmailConnectionStatus } from '@/types/gmail';

interface GmailConnectionData {
  id: string;
  email: string;
  status: GmailConnectionStatus;
  last_sync_at: string | null;
  error_message: string | null;
  created_at: string;
  sync_enabled?: boolean;
  initial_sync_done?: boolean;
  sync_errors_count?: number;
  last_sync_error?: string | null;
  watch_expiration?: string | null;
}

export function GmailConnection() {
  const [connections, setConnections] = useState<GmailConnectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<GmailConnectionData | null>(null);
  const [togglingSync, setTogglingSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  const fetchConnections = async () => {
    try {
      const response = await fetch(`/api/gmail/connections`);
      if (response.ok) {
        const data = await response.json();
        setConnections(data.connections);
      }
    } catch (error) {
      console.error('Error fetching Gmail connections:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleConnect = () => {
    window.location.href = `/api/gmail/connect`;
  };

  const handleDisconnect = async (connection: GmailConnectionData) => {
    setDisconnecting(connection.id);
    try {
      const response = await fetch('/api/gmail/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connection.id }),
      });

      if (response.ok) {
        setConnections((prev) => prev.filter((c) => c.id !== connection.id));
      }
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
    } finally {
      setDisconnecting(null);
      setConfirmDisconnect(null);
    }
  };

  const handleToggleSync = async (connection: GmailConnectionData, enabled: boolean) => {
    setTogglingSync(connection.id);
    try {
      const response = await fetch('/api/gmail/sync/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connection.id, enabled }),
      });

      if (response.ok) {
        const data = await response.json();
        setConnections((prev) =>
          prev.map((c) =>
            c.id === connection.id
              ? { ...c, sync_enabled: data.sync_enabled, watch_expiration: data.watch_expiration ?? c.watch_expiration }
              : c
          )
        );
      }
    } catch (error) {
      console.error('Error toggling sync:', error);
    } finally {
      setTogglingSync(null);
    }
  };

  const handleSyncNow = async (connectionId: string) => {
    setSyncing(connectionId);
    try {
      const response = await fetch('/api/gmail/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId }),
      });

      if (response.ok) {
        // Refresh connection data to show updated sync time
        await fetchConnections();
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
    } finally {
      setSyncing(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Gmail Connection
            </CardTitle>
            <CardDescription>
              Connect your Gmail account to send and track emails
            </CardDescription>
          </div>
          <Button onClick={handleConnect} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Connect Gmail
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : connections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No Gmail accounts connected</p>
            <p className="text-sm mt-1">
              Connect your Gmail to start sending tracked emails
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="border rounded-lg"
              >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{connection.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="secondary"
                        className={CONNECTION_STATUS_COLORS[connection.status]}
                      >
                        {CONNECTION_STATUS_LABELS[connection.status]}
                      </Badge>
                      {connection.last_sync_at && (
                        <span className="text-xs text-muted-foreground">
                          Last synced:{' '}
                          {new Date(connection.last_sync_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {connection.error_message && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        {connection.error_message}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmDisconnect(connection)}
                  disabled={disconnecting === connection.id}
                >
                  {disconnecting === connection.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </div>

              {/* Email Sync Controls */}
              {connection.status === 'connected' && (
                <>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between px-4 pb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={connection.sync_enabled ?? false}
                          onCheckedChange={(checked) => handleToggleSync(connection, checked)}
                          disabled={togglingSync === connection.id}
                        />
                        <span className="text-sm font-medium">
                          Email Sync
                        </span>
                      </div>
                      {togglingSync === connection.id && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                      {connection.sync_enabled && connection.initial_sync_done && (
                        <span className="text-xs text-muted-foreground">
                          {connection.last_sync_at
                            ? `Last synced ${new Date(connection.last_sync_at).toLocaleString()}`
                            : 'Not yet synced'}
                        </span>
                      )}
                      {connection.sync_enabled && !connection.initial_sync_done && (
                        <span className="text-xs text-muted-foreground">
                          Initial sync pending
                        </span>
                      )}
                    </div>
                    {connection.sync_enabled && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSyncNow(connection.id)}
                        disabled={syncing === connection.id}
                      >
                        {syncing === connection.id ? (
                          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1.5" />
                        )}
                        Sync Now
                      </Button>
                    )}
                  </div>
                  {connection.last_sync_error && (connection.sync_errors_count ?? 0) > 0 && (
                    <div className="flex items-center gap-1 px-4 pb-2 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {connection.last_sync_error}
                      {(connection.sync_errors_count ?? 0) >= 5 && (
                        <span className="ml-1">(sync disabled after repeated failures)</span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            ))}
          </div>
        )}

        <AlertDialog
          open={!!confirmDisconnect}
          onOpenChange={() => setConfirmDisconnect(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect Gmail Account</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to disconnect {confirmDisconnect?.email}? You
                will no longer be able to send emails from this account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => confirmDisconnect && handleDisconnect(confirmDisconnect)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Disconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
