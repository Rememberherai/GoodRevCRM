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
import { Mail, Plus, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { CONNECTION_STATUS_COLORS, CONNECTION_STATUS_LABELS, type GmailConnectionStatus } from '@/types/gmail';

interface GmailConnectionData {
  id: string;
  email: string;
  status: GmailConnectionStatus;
  last_sync_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface GmailConnectionProps {
  projectSlug: string;
}

export function GmailConnection({ projectSlug }: GmailConnectionProps) {
  const [connections, setConnections] = useState<GmailConnectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<GmailConnectionData | null>(null);

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
    window.location.href = `/api/gmail/connect?project=${projectSlug}`;
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
                className="flex items-center justify-between p-4 border rounded-lg"
              >
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
