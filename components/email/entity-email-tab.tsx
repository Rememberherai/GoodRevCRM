'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmailThreadViewer } from './email-thread-viewer';
import type { SyncedEmail } from '@/types/gmail';

interface EntityEmailTabProps {
  projectSlug: string;
  personId?: string;
  organizationId?: string;
}

interface ThreadSummary {
  thread_id: string;
  subject: string | null;
  latest_message: SyncedEmail;
  message_count: number;
  has_inbound: boolean;
  has_outbound: boolean;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function EntityEmailTab({ projectSlug, personId, organizationId }: EntityEmailTabProps) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<Record<string, SyncedEmail[]>>({});
  const [loadingThread, setLoadingThread] = useState<string | null>(null);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (personId) params.set('person_id', personId);
      if (organizationId) params.set('organization_id', organizationId);
      params.set('limit', '100');

      const response = await fetch(
        `/api/projects/${projectSlug}/email/inbox?${params}`
      );
      if (!response.ok) return;

      const data = await response.json();
      const emails: SyncedEmail[] = data.emails ?? [];

      // Group by thread
      const threadMap = new Map<string, SyncedEmail[]>();
      for (const email of emails) {
        const key = email.gmail_thread_id;
        if (!threadMap.has(key)) threadMap.set(key, []);
        threadMap.get(key)!.push(email);
      }

      // Build thread summaries
      const summaries: ThreadSummary[] = [];
      for (const [threadId, msgs] of threadMap) {
        if (msgs.length === 0) continue;
        msgs.sort((a, b) => new Date(a.email_date).getTime() - new Date(b.email_date).getTime());
        const first = msgs[0]!;
        const latest = msgs[msgs.length - 1]!;
        summaries.push({
          thread_id: threadId,
          subject: first.subject,
          latest_message: latest,
          message_count: msgs.length,
          has_inbound: msgs.some(m => m.direction === 'inbound'),
          has_outbound: msgs.some(m => m.direction === 'outbound'),
        });
      }

      // Sort by latest message date, newest first
      summaries.sort((a, b) =>
        new Date(b.latest_message.email_date).getTime() - new Date(a.latest_message.email_date).getTime()
      );

      setThreads(summaries);
    } catch (err) {
      console.error('Error loading emails:', err);
    } finally {
      setLoading(false);
    }
  }, [projectSlug, personId, organizationId]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  const loadThreadMessages = async (threadId: string) => {
    if (threadMessages[threadId]) {
      // Already loaded
      setExpandedThread(expandedThread === threadId ? null : threadId);
      return;
    }

    setLoadingThread(threadId);
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/email/thread/${threadId}`
      );
      if (!response.ok) return;

      const data = await response.json();
      setThreadMessages(prev => ({ ...prev, [threadId]: data.messages }));
      setExpandedThread(threadId);
    } catch (err) {
      console.error('Error loading thread:', err);
    } finally {
      setLoadingThread(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading emails...</span>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Mail className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No email conversations found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Emails will appear here once synced from Gmail
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={loadEmails}>
          <RefreshCw className="h-3 w-3 mr-1.5" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          {threads.length} conversation{threads.length !== 1 ? 's' : ''}
        </p>
        <Button variant="ghost" size="sm" onClick={loadEmails}>
          <RefreshCw className="h-3 w-3 mr-1.5" />
          Refresh
        </Button>
      </div>

      {threads.map(thread => (
        <div key={thread.thread_id}>
          {/* Thread row */}
          <button
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors text-left"
            onClick={() => loadThreadMessages(thread.thread_id)}
          >
            <div className="flex-shrink-0">
              {thread.latest_message.direction === 'inbound' ? (
                <ArrowDownLeft className="h-4 w-4 text-blue-500" />
              ) : (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {thread.subject || '(no subject)'}
                </span>
                {thread.message_count > 1 && (
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    {thread.message_count}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {thread.latest_message.snippet}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {thread.has_inbound && thread.has_outbound && (
                <Badge variant="outline" className="text-xs">
                  2-way
                </Badge>
              )}
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(thread.latest_message.email_date)}
              </span>
              {loadingThread === thread.thread_id && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
            </div>
          </button>

          {/* Expanded thread */}
          {expandedThread === thread.thread_id && threadMessages[thread.thread_id] && (
            <div className="ml-7 mt-1 mb-3">
              <EmailThreadViewer
                messages={threadMessages[thread.thread_id] ?? []}
                subject={null}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
