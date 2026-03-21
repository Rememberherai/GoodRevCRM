'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Megaphone, Send, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RecipientFilter } from '@/components/community/broadcasts/recipient-filter';
import { EmailBodyEditor } from '@/components/sequences/sequence-builder/email-body-editor';

interface BroadcastRecord {
  id: string;
  subject: string;
  body: string;
  channel: 'email' | 'sms' | 'both';
  status: string;
  updated_at: string;
  failure_reason: string | null;
}

interface RecipientFilterValue {
  person_ids?: string[];
  household_ids?: string[];
  program_ids?: string[];
}

export function BroadcastsPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [broadcasts, setBroadcasts] = useState<BroadcastRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [channel, setChannel] = useState<'email' | 'sms' | 'both'>('email');
  const [filterCriteria, setFilterCriteria] = useState<RecipientFilterValue>({});
  const [isSaving, setIsSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const loadBroadcasts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/broadcasts`);
      const data = await response.json() as { broadcasts?: BroadcastRecord[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load broadcasts');
      }
      setBroadcasts(data.broadcasts ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load broadcasts');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadBroadcasts();
  }, [loadBroadcasts]);

  const previewCount = useMemo(() => Object.values(filterCriteria).reduce((sum, value) => sum + (value?.length ?? 0), 0), [filterCriteria]);

  async function handleCreate() {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          body: bodyText,
          body_html: bodyHtml,
          channel,
          filter_criteria: filterCriteria,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create broadcast');
      }
      setOpen(false);
      setSubject('');
      setBodyHtml('');
      setBodyText('');
      setChannel('email');
      setFilterCriteria({});
      await loadBroadcasts();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create broadcast');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSend(id: string) {
    setSendingId(id);
    try {
      const response = await fetch(`/api/projects/${slug}/broadcasts/${id}/send`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to send broadcast');
      }
      await loadBroadcasts();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to send broadcast');
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Broadcasts</h2>
            <p className="text-sm text-muted-foreground">
              Email and SMS announcements for programs, households, and community updates.
            </p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Broadcast
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Broadcast History</CardTitle>
          <CardDescription>Draft, send, and monitor delivery failures for community announcements.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-lg bg-muted" />)
          ) : broadcasts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">No broadcasts created yet.</div>
          ) : (
            broadcasts.map((broadcast) => (
              <div key={broadcast.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">{broadcast.subject}</div>
                    <div className="line-clamp-2 text-sm text-muted-foreground">{broadcast.body}</div>
                    {broadcast.failure_reason && (
                      <div className="text-xs text-destructive">{broadcast.failure_reason}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <div className="flex gap-2">
                      <Badge variant="outline">{broadcast.channel}</Badge>
                      <Badge variant={broadcast.status === 'sent' ? 'default' : broadcast.status === 'failed' ? 'destructive' : 'secondary'}>
                        {broadcast.status}
                      </Badge>
                    </div>
                    <Button size="sm" onClick={() => void handleSend(broadcast.id)} disabled={sendingId === broadcast.id || broadcast.status === 'sent'}>
                      <Send className="mr-2 h-4 w-4" />
                      {sendingId === broadcast.id ? 'Sending…' : 'Send'}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create Broadcast</DialogTitle>
            <DialogDescription>Choose recipients, channel, and message content before sending.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div className="space-y-2">
                <Label htmlFor="broadcast-subject">Subject</Label>
                <Input id="broadcast-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select value={channel} onValueChange={(value: 'email' | 'sms' | 'both') => setChannel(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms" disabled className="text-muted-foreground">SMS (coming soon)</SelectItem>
                    <SelectItem value="both" disabled className="text-muted-foreground">Both (coming soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <EmailBodyEditor
                value={bodyHtml}
                onChange={(html, text) => { setBodyHtml(html); setBodyText(text); }}
                showVariablePicker={false}
              />
            </div>

            <div className="space-y-3">
              <div>
                <div className="font-medium">Recipients</div>
                <div className="text-sm text-muted-foreground">
                  Select the people, households, or programs to include. Current filter picks: {previewCount}
                </div>
              </div>
              <RecipientFilter value={filterCriteria} onChange={setFilterCriteria} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={() => void handleCreate()} disabled={isSaving || !subject.trim() || !bodyText.trim()}>
              Create Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
