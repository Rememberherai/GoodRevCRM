'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Loader2,
  UserPlus,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { toast } from 'sonner';

interface UnknownSender {
  from_email: string;
  from_name: string;
  organization_id: string;
  organization_name: string;
  organization_domain: string | null;
  email_count: number;
  latest_email_date: string;
  earliest_email_date: string;
}

interface UnknownSendersPanelProps {
  projectSlug: string;
  organizationId?: string;
  /** Compact mode shows just a banner with count, expandable to full list */
  compact?: boolean;
  /** Called when all senders are resolved (for parent to hide banner) */
  onAllResolved?: () => void;
}

function parseName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    first: parts[0] ?? '',
    last: parts.slice(1).join(' ') || '',
  };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function UnknownSendersPanel({
  projectSlug,
  organizationId,
  compact = false,
  onAllResolved,
}: UnknownSendersPanelProps) {
  const [senders, setSenders] = useState<UnknownSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);
  const [editingSender, setEditingSender] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', job_title: '' });
  const [creating, setCreating] = useState<string | null>(null);

  const loadSenders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (organizationId) params.set('organization_id', organizationId);

      const response = await fetch(
        `/api/projects/${projectSlug}/email/unknown-senders?${params}`
      );
      if (!response.ok) return;

      const data = await response.json();
      setSenders(data.senders ?? []);

      if ((data.senders ?? []).length === 0 && onAllResolved) {
        onAllResolved();
      }
    } catch (err) {
      console.error('Error loading unknown senders:', err);
    } finally {
      setLoading(false);
    }
  }, [projectSlug, organizationId, onAllResolved]);

  useEffect(() => {
    loadSenders();
  }, [loadSenders]);

  const startEdit = (sender: UnknownSender) => {
    const { first, last } = parseName(sender.from_name);
    setEditForm({ first_name: first, last_name: last, job_title: '' });
    setEditingSender(sender.from_email);
  };

  const createContact = async (sender: UnknownSender) => {
    setCreating(sender.from_email);
    try {
      const body: Record<string, string> = {
        from_email: sender.from_email,
        organization_id: sender.organization_id,
      };

      // If editing, use the form values; otherwise let the API auto-parse
      if (editingSender === sender.from_email) {
        if (editForm.first_name) body.first_name = editForm.first_name;
        if (editForm.last_name) body.last_name = editForm.last_name;
        if (editForm.job_title) body.job_title = editForm.job_title;
      }

      const response = await fetch(
        `/api/projects/${projectSlug}/email/unknown-senders/create-contact`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        toast.error(err.error || 'Failed to create contact');
        return;
      }

      const data = await response.json();
      toast.success(
        `Created ${data.person.first_name} ${data.person.last_name} — ${data.emails_linked} emails linked`
      );

      // Remove from list
      setSenders(prev => {
        const next = prev.filter(s => s.from_email !== sender.from_email);
        if (next.length === 0 && onAllResolved) {
          onAllResolved();
        }
        return next;
      });
      setEditingSender(null);
    } catch (err) {
      console.error('Error creating contact:', err);
      toast.error('Failed to create contact');
    } finally {
      setCreating(null);
    }
  };

  const createAllForOrg = async (orgId: string) => {
    const orgSenders = senders.filter(s => s.organization_id === orgId);
    for (const sender of orgSenders) {
      await createContact(sender);
    }
  };

  if (loading) {
    return compact ? null : (
      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking for unknown senders...
      </div>
    );
  }

  if (senders.length === 0) {
    return null;
  }

  // Group by organization for display
  const byOrg = new Map<string, { name: string; domain: string | null; senders: UnknownSender[] }>();
  for (const sender of senders) {
    const existing = byOrg.get(sender.organization_id);
    if (existing) {
      existing.senders.push(sender);
    } else {
      byOrg.set(sender.organization_id, {
        name: sender.organization_name,
        domain: sender.organization_domain,
        senders: [sender],
      });
    }
  }

  const uniqueSenderCount = senders.length;
  const totalEmails = senders.reduce((sum, s) => sum + s.email_count, 0);

  if (compact && !expanded) {
    return (
      <Alert className="cursor-pointer border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" onClick={() => setExpanded(true)}>
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">
          {totalEmails} email{totalEmails !== 1 ? 's' : ''} from {uniqueSenderCount} unknown sender{uniqueSenderCount !== 1 ? 's' : ''}
        </AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300">
          These people emailed from this organization but aren&apos;t in your CRM yet.
          <span className="ml-1 underline">Review &amp; create contacts</span>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {compact && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200 flex items-center justify-between">
            <span>
              {totalEmails} email{totalEmails !== 1 ? 's' : ''} from {uniqueSenderCount} unknown sender{uniqueSenderCount !== 1 ? 's' : ''}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(false)} className="h-6 px-2">
              Hide
            </Button>
          </AlertTitle>
        </Alert>
      )}

      {[...byOrg.entries()].map(([orgId, org]) => (
        <div key={orgId} className="space-y-2">
          {!organizationId && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{org.name}</h4>
                {org.domain && (
                  <Badge variant="outline" className="text-xs">{org.domain}</Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {org.senders.length} unknown sender{org.senders.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => createAllForOrg(orgId)}
                className="text-xs"
              >
                <UserPlus className="h-3 w-3 mr-1" />
                Create All
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            {org.senders.map(sender => (
              <div
                key={sender.from_email}
                className="flex items-center gap-3 p-2.5 rounded-lg border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {sender.from_name || sender.from_email}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {sender.email_count} email{sender.email_count !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {sender.from_email} · Latest: {formatDate(sender.latest_email_date)}
                  </p>

                  {/* Inline edit form */}
                  {editingSender === sender.from_email && (
                    <div className="flex items-end gap-2 mt-2">
                      <div className="flex-1">
                        <Label className="text-xs">First Name</Label>
                        <Input
                          value={editForm.first_name}
                          onChange={e => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Last Name</Label>
                        <Input
                          value={editForm.last_name}
                          onChange={e => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Job Title</Label>
                        <Input
                          value={editForm.job_title}
                          onChange={e => setEditForm(prev => ({ ...prev, job_title: e.target.value }))}
                          className="h-7 text-xs"
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {editingSender !== sender.from_email ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => startEdit(sender)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => createContact(sender)}
                        disabled={creating === sender.from_email}
                      >
                        {creating === sender.from_email ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="h-3 w-3 mr-1" />
                            Create
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setEditingSender(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => createContact(sender)}
                        disabled={creating === sender.from_email}
                      >
                        {creating === sender.from_email ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Save & Create
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
