'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Megaphone, Send, Plus, Blocks, Code, CalendarIcon, Clock, X, RotateCcw, Pencil, Trash2, Copy } from 'lucide-react';
import { format, isBefore, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RecipientFilter } from '@/components/community/broadcasts/recipient-filter';
import { EmailBodyEditor } from '@/components/sequences/sequence-builder/email-body-editor';
import { EmailBuilder } from '@/components/email-builder/email-builder';
import { TemplatePicker } from '@/components/email-builder/template-picker';
import { useEmailBuilderStore } from '@/stores/email-builder';
import { validateDesign, hasBlockingErrors } from '@/lib/email-builder/validation';
import { getVariablesForProjectType } from '@/lib/email-builder/variables';
import { createDefaultDesign } from '@/lib/email-builder/default-blocks';
import { renderDesignToInnerHtml } from '@/lib/email-builder/render-html';
import { renderDesignToText } from '@/lib/email-builder/render-text';
import { emailDesignSchema } from '@/lib/email-builder/schema';
import type { EmailDesign } from '@/types/email-builder';
import { cn } from '@/lib/utils';

type EditorMode = 'builder' | 'html';

interface RecipientFilterValue {
  person_ids?: string[];
  household_ids?: string[];
  program_ids?: string[];
}

interface BroadcastRecord {
  id: string;
  subject: string;
  body: string;
  body_html: string | null;
  channel: 'email' | 'sms' | 'both';
  status: string;
  updated_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
  failure_reason: string | null;
  send_config_id: string | null;
  design_json: Record<string, unknown> | null;
  filter_criteria: RecipientFilterValue | null;
}

interface EmailSendConfigOption {
  id: string;
  provider: 'gmail' | 'resend';
  from_email: string | null;
  from_name: string | null;
  gmail_email: string | null;
  is_default: boolean | null;
  domain_verified: boolean | null;
}

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  sent: 'default',
  failed: 'destructive',
  sending: 'outline',
  scheduled: 'outline',
  draft: 'secondary',
};

function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

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
  const [editorMode, setEditorMode] = useState<EditorMode>('builder');
  const [filterCriteria, setFilterCriteria] = useState<RecipientFilterValue>({});
  const [isSaving, setIsSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [signatureHtml, setSignatureHtml] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Edit state — when set, dialog is in edit mode for this broadcast
  const [editingBroadcast, setEditingBroadcast] = useState<BroadcastRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Scheduling state
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState('09:00');

  // Send config state (email provider)
  const [sendConfigs, setSendConfigs] = useState<EmailSendConfigOption[]>([]);
  const [sendConfigId, setSendConfigId] = useState<string | null>(null);

  // Builder store
  const design = useEmailBuilderStore((s) => s.design);
  const resetDesign = useEmailBuilderStore((s) => s.resetDesign);

  // Community projects always get community variables
  const builderVariables = useMemo(() => getVariablesForProjectType('community'), []);
  const defaultSendConfig = useMemo(
    () => sendConfigs.find((config) => config.is_default && (config.provider !== 'resend' || config.domain_verified)) ?? null,
    [sendConfigs]
  );

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

  // Fetch email send configs for "Send from" picker
  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const res = await fetch(`/api/projects/${slug}/settings/email-providers`);
        if (res.ok) {
          const data = await res.json();
          const configs: EmailSendConfigOption[] = data.configs ?? [];
          setSendConfigs(configs);
          // Pre-select the default
          const defaultConfig = configs.find((c) => c.is_default && (c.provider !== 'resend' || c.domain_verified));
          if (defaultConfig) setSendConfigId(defaultConfig.id);
        }
      } catch {
        // non-critical
      }
    };
    void fetchConfigs();
  }, [slug]);

  // Fetch default signature once
  useEffect(() => {
    const fetchSig = async () => {
      try {
        const res = await fetch(`/api/projects/${slug}/signatures`);
        if (res.ok) {
          const data = await res.json();
          const defaultSig = (data.data ?? []).find((s: { is_default: boolean }) => s.is_default);
          setSignatureHtml(defaultSig?.content_html ?? null);
        }
      } catch {
        // non-critical
      }
    };
    void fetchSig();
  }, [slug]);

  const previewCount = useMemo(() => Object.values(filterCriteria).reduce((sum, value) => sum + (value?.length ?? 0), 0), [filterCriteria]);

  // Check if we have content to submit
  const hasContent = editorMode === 'builder'
    ? design.blocks.length > 0
    : bodyHtml.trim().length > 0;

  function switchToBuilder() {
    if (editorMode === 'builder') return;
    const html = bodyHtml.trim();
    if (html) {
      useEmailBuilderStore.getState().loadDesign({
        ...createDefaultDesign(),
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            html,
          },
        ],
      });
    } else {
      resetDesign();
    }
    setValidationErrors([]);
    setEditorMode('builder');
  }

  function validateBuilderDesign() {
    const vErrors = validateDesign(useEmailBuilderStore.getState().design);
    if (hasBlockingErrors(vErrors)) {
      setValidationErrors(vErrors.filter((e) => e.severity === 'error').map((e) => e.message));
      return false;
    }
    setValidationErrors([]);
    return true;
  }

  function switchToHtml() {
    if (editorMode === 'html') return;
    if (!validateBuilderDesign()) {
      return;
    }
    const currentDesign = useEmailBuilderStore.getState().design;
    if (currentDesign.blocks.length > 0) {
      setBodyHtml(renderDesignToInnerHtml(currentDesign));
      setBodyText(renderDesignToText(currentDesign));
    } else if (signatureHtml) {
      setBodyHtml(`<p></p><br/><div data-signature="true">${signatureHtml}</div>`);
      setBodyText('');
    } else {
      setBodyHtml('');
      setBodyText('');
    }
    setValidationErrors([]);
    setEditorMode('html');
  }

  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      subject,
      channel,
      filter_criteria: filterCriteria,
    };

    if (sendConfigId) {
      payload.send_config_id = sendConfigId;
    }

    if (editorMode === 'builder') {
      payload.design_json = design;
    } else {
      payload.body = bodyText;
      payload.body_html = bodyHtml;
    }

    return payload;
  }

  function resetDialog() {
    setOpen(false);
    setEditingBroadcast(null);
    setSubject('');
    setBodyHtml('');
    setBodyText('');
    setChannel('email');
    setEditorMode('builder');
    setFilterCriteria({});
    setValidationErrors([]);
    setError(null);
    setScheduleDate(undefined);
    setScheduleTime('09:00');
    setSendConfigId(defaultSendConfig?.id ?? null);
    resetDesign();
  }

  async function handleCreate() {
    setValidationErrors([]);

    if (editorMode === 'builder' && !validateBuilderDesign()) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const payload = buildPayload();

      const response = await fetch(`/api/projects/${slug}/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create broadcast');
      }
      resetDialog();
      await loadBroadcasts();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create broadcast');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateAndSchedule() {
    if (!scheduleDate) return;

    setValidationErrors([]);

    if (editorMode === 'builder' && !validateBuilderDesign()) {
      return;
    }

    // Build the scheduled_at ISO string
    const parts = scheduleTime.split(':').map(Number);
    const hours = parts[0] ?? 0;
    const minutes = parts[1] ?? 0;
    const scheduledAt = new Date(scheduleDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    if (isBefore(scheduledAt, new Date())) {
      setValidationErrors(['Scheduled time must be in the future.']);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...buildPayload(),
          status: 'scheduled',
          scheduled_at: scheduledAt.toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to schedule broadcast');
      }

      resetDialog();
      await loadBroadcasts();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to schedule broadcast');
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

  async function handleCancelSchedule(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/broadcasts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft', scheduled_at: null }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to cancel schedule');
      }
      await loadBroadcasts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel schedule');
    }
  }

  async function handleRetry(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/broadcasts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft', failure_reason: null }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to reset broadcast');
      }
      await loadBroadcasts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset broadcast');
    }
  }

  async function handleEdit(broadcast: BroadcastRecord) {
    // Load design into builder store if present
    let parsedDesign: EmailDesign | null = null;
    if (broadcast.design_json) {
      const result = emailDesignSchema.safeParse(broadcast.design_json);
      if (result.success) parsedDesign = result.data;
    }

    setEditingBroadcast(broadcast);
    setSubject(broadcast.subject);
    setChannel(broadcast.channel);
    setSendConfigId(broadcast.send_config_id);
    setFilterCriteria((broadcast.filter_criteria as RecipientFilterValue) ?? {});
    setValidationErrors([]);
    setError(null);

    if (parsedDesign) {
      setEditorMode('builder');
      useEmailBuilderStore.getState().loadDesign(parsedDesign);
      setBodyHtml(broadcast.body_html ?? '');
      setBodyText(broadcast.body ?? '');
    } else {
      setEditorMode('html');
      setBodyHtml(broadcast.body_html ?? '');
      setBodyText(broadcast.body ?? '');
      resetDesign();
    }

    if (broadcast.scheduled_at) {
      const d = new Date(broadcast.scheduled_at);
      setScheduleDate(d);
      setScheduleTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    } else {
      setScheduleDate(undefined);
      setScheduleTime('09:00');
    }

    setOpen(true);
  }

  async function handleUpdate() {
    if (!editingBroadcast) return;

    setValidationErrors([]);
    if (editorMode === 'builder' && !validateBuilderDesign()) return;

    setIsSaving(true);
    setError(null);
    try {
      const payload = buildPayload();

      const response = await fetch(`/api/projects/${slug}/broadcasts/${editingBroadcast.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to update broadcast');
      }
      resetDialog();
      await loadBroadcasts();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to update broadcast');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateAndSchedule() {
    if (!editingBroadcast || !scheduleDate) return;

    setValidationErrors([]);
    if (editorMode === 'builder' && !validateBuilderDesign()) return;

    const parts = scheduleTime.split(':').map(Number);
    const hours = parts[0] ?? 0;
    const minutes = parts[1] ?? 0;
    const scheduledAt = new Date(scheduleDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    if (isBefore(scheduledAt, new Date())) {
      setValidationErrors(['Scheduled time must be in the future.']);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/broadcasts/${editingBroadcast.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...buildPayload(),
          status: 'scheduled',
          scheduled_at: scheduledAt.toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to schedule broadcast');
      }
      resetDialog();
      await loadBroadcasts();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to schedule broadcast');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this broadcast? This cannot be undone.')) return;
    setIsDeleting(id);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/broadcasts/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to delete broadcast');
      }
      await loadBroadcasts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete broadcast');
    } finally {
      setIsDeleting(null);
    }
  }

  async function handleDuplicate(broadcast: BroadcastRecord) {
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        subject: `${broadcast.subject} (copy)`,
        channel: broadcast.channel,
        filter_criteria: broadcast.filter_criteria ?? {},
      };
      if (broadcast.design_json) {
        payload.design_json = broadcast.design_json;
      } else {
        payload.body = broadcast.body;
        payload.body_html = broadcast.body_html;
      }
      if (broadcast.send_config_id) {
        payload.send_config_id = broadcast.send_config_id;
      }

      const response = await fetch(`/api/projects/${slug}/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to duplicate broadcast');
      }
      await loadBroadcasts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate broadcast');
    }
  }

  function handleOpenDialog() {
    setEditingBroadcast(null);
    setSubject('');
    setBodyText('');
    setBodyHtml('');
    setChannel('email');
    setEditorMode('builder');
    setFilterCriteria({});
    resetDesign();
    setValidationErrors([]);
    setError(null);
    setScheduleDate(undefined);
    setScheduleTime('09:00');
    setSendConfigId(defaultSendConfig?.id ?? null);
    setOpen(true);
  }

  function renderBroadcastActions(broadcast: BroadcastRecord) {
    const isSending = sendingId === broadcast.id;
    const canEdit = ['draft', 'scheduled', 'failed'].includes(broadcast.status);
    const canDelete = ['draft', 'failed'].includes(broadcast.status);

    return (
      <div className="flex items-center gap-1">
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={() => void handleEdit(broadcast)} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => void handleDuplicate(broadcast)} title="Duplicate">
          <Copy className="h-3.5 w-3.5" />
        </Button>
        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void handleDelete(broadcast.id)}
            disabled={isDeleting === broadcast.id}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        )}
        {broadcast.status === 'draft' && (
          <Button size="sm" onClick={() => void handleSend(broadcast.id)} disabled={isSending}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {isSending ? 'Sending...' : 'Send'}
          </Button>
        )}
        {broadcast.status === 'scheduled' && (
          <Button size="sm" variant="outline" onClick={() => void handleCancelSchedule(broadcast.id)}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
        {broadcast.status === 'failed' && (
          <Button size="sm" variant="outline" onClick={() => void handleRetry(broadcast.id)}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  function renderBroadcastMeta(broadcast: BroadcastRecord) {
    if (broadcast.status === 'scheduled' && broadcast.scheduled_at) {
      return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Scheduled for {format(new Date(broadcast.scheduled_at), 'MMM d, yyyy h:mm a')}
        </div>
      );
    }
    if (broadcast.status === 'sent' && broadcast.sent_at) {
      return (
        <div className="text-xs text-muted-foreground">
          Sent {format(new Date(broadcast.sent_at), 'MMM d, yyyy h:mm a')}
        </div>
      );
    }
    return null;
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
        <Button onClick={handleOpenDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New Broadcast
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Broadcast History</CardTitle>
          <CardDescription>Draft, schedule, send, and monitor delivery for community announcements.</CardDescription>
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
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="font-medium">{broadcast.subject}</div>
                    <div className="line-clamp-2 text-sm text-muted-foreground">{broadcast.body}</div>
                    {broadcast.failure_reason && (
                      <div className="text-xs text-destructive">{broadcast.failure_reason}</div>
                    )}
                    {renderBroadcastMeta(broadcast)}
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end shrink-0">
                    <div className="flex gap-2">
                      <Badge variant="outline">{broadcast.channel}</Badge>
                      <Badge variant={STATUS_BADGE_VARIANT[broadcast.status] ?? 'secondary'}>
                        {broadcast.status}
                      </Badge>
                    </div>
                    {renderBroadcastActions(broadcast)}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setOpen(true);
          } else {
            resetDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingBroadcast ? 'Edit Broadcast' : 'Create Broadcast'}</DialogTitle>
            <DialogDescription>Choose recipients, channel, and message content. Save as draft or schedule for later.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
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

            {/* Send From picker — only shown when email channel and configs exist */}
            {channel === 'email' && sendConfigs.length > 0 && (
              <div className="space-y-2">
                <Label>Send From</Label>
                <Select
                  value={sendConfigId ?? 'sender_gmail'}
                  onValueChange={(value) => setSendConfigId(value === 'sender_gmail' ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sender Gmail fallback" />
                  </SelectTrigger>
                  <SelectContent>
                    {!defaultSendConfig && (
                      <SelectItem value="sender_gmail">Sender Gmail fallback</SelectItem>
                    )}
                    {sendConfigs.map((config) => {
                      const label = config.provider === 'gmail'
                        ? config.gmail_email ?? 'Gmail'
                        : config.from_name
                          ? `${config.from_name} <${config.from_email}>`
                          : config.from_email ?? 'Resend';
                      return (
                        <SelectItem
                          key={config.id}
                          value={config.id}
                          disabled={config.provider === 'resend' && !config.domain_verified}
                        >
                          {label}
                          {config.provider === 'resend' && !config.domain_verified && ' (unverified)'}
                          {config.is_default && ' (default)'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Message editor with builder/HTML toggle (email channel only) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Message</Label>
                {channel === 'email' && (
                  <div className="flex items-center rounded-lg border bg-muted p-0.5">
                    <Button
                      type="button"
                      variant={editorMode === 'builder' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={switchToBuilder}
                      disabled={editorMode === 'builder'}
                    >
                      <Blocks className="h-3.5 w-3.5" />
                      Builder
                    </Button>
                    <Button
                      type="button"
                      variant={editorMode === 'html' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={switchToHtml}
                      disabled={editorMode === 'html'}
                    >
                      <Code className="h-3.5 w-3.5" />
                      HTML
                    </Button>
                  </div>
                )}
              </div>

              {editorMode === 'builder' && channel === 'email' ? (
                <>
                  {design.blocks.length === 0 && (
                    <TemplatePicker
                      onSelect={(templateDesign) => {
                        useEmailBuilderStore.getState().loadDesign(templateDesign);
                      }}
                    />
                  )}
                  <div className="border rounded-lg overflow-hidden" style={{ height: 480 }}>
                    <EmailBuilder showPreview variables={builderVariables} slug={slug} />
                  </div>
                </>
              ) : (
                <EmailBodyEditor
                  value={bodyHtml}
                  onChange={(html, text) => { setBodyHtml(html); setBodyText(text); }}
                  showVariablePicker={false}
                />
              )}
            </div>

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="space-y-1">
                {validationErrors.map((msg, i) => (
                  <p key={i} className="text-sm text-red-500">{msg}</p>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <div className="font-medium">Recipients</div>
                <div className="text-sm text-muted-foreground">
                  Select the people, households, or programs to include. Current filter picks: {previewCount}
                </div>
              </div>
              <RecipientFilter value={filterCriteria} onChange={setFilterCriteria} />
            </div>

            {/* Scheduling */}
            <div className="space-y-2">
              <Label>Schedule (optional)</Label>
              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-[200px] justify-start text-left font-normal',
                        !scheduleDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduleDate ? format(scheduleDate, 'MMM d, yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduleDate}
                      onSelect={setScheduleDate}
                      disabled={(date) => isBefore(date, startOfDay(new Date()))}
                    />
                  </PopoverContent>
                </Popover>

                <Select value={scheduleTime} onValueChange={setScheduleTime}>
                  <SelectTrigger className="w-[120px]">
                    <Clock className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {scheduleDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setScheduleDate(undefined)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Times are in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
              </p>
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={resetDialog} disabled={isSaving}>Cancel</Button>
            {scheduleDate ? (
              <Button
                onClick={() => void (editingBroadcast ? handleUpdateAndSchedule() : handleCreateAndSchedule())}
                disabled={isSaving || !subject.trim() || !hasContent}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {isSaving ? 'Scheduling...' : 'Schedule Broadcast'}
              </Button>
            ) : (
              <Button
                onClick={() => void (editingBroadcast ? handleUpdate() : handleCreate())}
                disabled={isSaving || !subject.trim() || !hasContent}
              >
                {isSaving ? 'Saving...' : editingBroadcast ? 'Save Changes' : 'Create Draft'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
