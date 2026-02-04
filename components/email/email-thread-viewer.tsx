'use client';

import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Paperclip,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SyncedEmail } from '@/types/gmail';

interface EmailMessage extends SyncedEmail {
  tracking?: {
    opens: number;
    clicks: number;
    first_open_at: string | null;
  } | null;
}

interface EmailThreadViewerProps {
  messages: EmailMessage[];
  subject: string | null;
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
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function EmailMessageItem({ message, defaultExpanded }: { message: EmailMessage; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isInbound = message.direction === 'inbound';

  return (
    <div className="border rounded-lg">
      {/* Collapsed header */}
      <button
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-shrink-0">
          {isInbound ? (
            <ArrowDownLeft className="h-4 w-4 text-blue-500" />
          ) : (
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {message.from_name || message.from_email}
            </span>
            {message.from_name && (
              <span className="text-xs text-muted-foreground truncate">
                &lt;{message.from_email}&gt;
              </span>
            )}
          </div>
          {!expanded && message.snippet && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {message.snippet}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {message.attachments && message.attachments.length > 0 && (
            <Paperclip className="h-3 w-3 text-muted-foreground" />
          )}
          {message.tracking && message.tracking.opens > 0 && (
            <Badge variant="secondary" className="text-xs">
              {message.tracking.opens} open{message.tracking.opens !== 1 ? 's' : ''}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(message.email_date)}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t px-4 py-3">
          <div className="text-xs text-muted-foreground space-y-1 mb-3">
            <div>
              <span className="font-medium">From:</span>{' '}
              {message.from_name ? `${message.from_name} <${message.from_email}>` : message.from_email}
            </div>
            <div>
              <span className="font-medium">To:</span>{' '}
              {message.to_emails.join(', ')}
            </div>
            {message.cc_emails.length > 0 && (
              <div>
                <span className="font-medium">Cc:</span>{' '}
                {message.cc_emails.join(', ')}
              </div>
            )}
            <div>
              <span className="font-medium">Date:</span>{' '}
              {formatFullDate(message.email_date)}
            </div>
          </div>

          {message.body_html ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none overflow-auto"
              dangerouslySetInnerHTML={{ __html: message.body_html }}
            />
          ) : message.body_text ? (
            <pre className="text-sm whitespace-pre-wrap font-sans">{message.body_text}</pre>
          ) : (
            <p className="text-sm text-muted-foreground italic">No content</p>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Attachments ({message.attachments.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {message.attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 text-xs bg-accent/50 rounded px-2 py-1"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="truncate max-w-[200px]">{att.filename}</span>
                    <span className="text-muted-foreground">
                      ({Math.round(att.size / 1024)}KB)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tracking stats for outbound */}
          {message.tracking && (
            <div className="mt-3 pt-3 border-t flex gap-4 text-xs text-muted-foreground">
              <span>{message.tracking.opens} open{message.tracking.opens !== 1 ? 's' : ''}</span>
              <span>{message.tracking.clicks} click{message.tracking.clicks !== 1 ? 's' : ''}</span>
              {message.tracking.first_open_at && (
                <span>First opened {formatDate(message.tracking.first_open_at)}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EmailThreadViewer({ messages, subject }: EmailThreadViewerProps) {
  if (messages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">No messages in this thread</p>
    );
  }

  return (
    <div className="space-y-2">
      {subject && (
        <h4 className="font-medium text-sm mb-3">{subject}</h4>
      )}
      {messages.map((message, idx) => (
        <EmailMessageItem
          key={message.id}
          message={message}
          defaultExpanded={idx === messages.length - 1}
        />
      ))}
    </div>
  );
}
