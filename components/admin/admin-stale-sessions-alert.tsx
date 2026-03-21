'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ActiveSession {
  id: string;
  project_id: string;
  project_name: string;
  project_slug: string;
  entered_at: string;
}

interface AdminStaleSessionsAlertProps {
  sessions: ActiveSession[];
  onExit: (sessionId: string) => void;
  isExiting?: string | null;
}

function formatDuration(enteredAt: string): string {
  const hours = Math.floor(
    (Date.now() - new Date(enteredAt).getTime()) / (1000 * 60 * 60)
  );
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

export function AdminStaleSessionsAlert({
  sessions,
  onExit,
  isExiting,
}: AdminStaleSessionsAlertProps) {
  // Only show sessions older than 24 hours
  const staleSessions = sessions.filter((s) => {
    const ageMs = Date.now() - new Date(s.entered_at).getTime();
    return ageMs > 24 * 60 * 60 * 1000;
  });

  if (staleSessions.length === 0) return null;

  return (
    <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
          <AlertTriangle className="h-4 w-4" />
          You have active admin sessions older than 24 hours
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {staleSessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between rounded-md bg-white/50 dark:bg-black/20 px-3 py-2"
            >
              <div>
                <span className="text-sm font-medium">{session.project_name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  entered {formatDuration(session.entered_at)}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onExit(session.id)}
                disabled={isExiting === session.id}
              >
                {isExiting === session.id ? 'Exiting...' : 'Exit'}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
