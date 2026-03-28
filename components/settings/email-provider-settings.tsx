'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, Star, Mail, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface EmailProviderSettingsProps {
  slug: string;
}

interface EmailSendConfig {
  id: string;
  provider: 'gmail' | 'resend';
  gmail_connection_id: string | null;
  gmail_email: string | null;
  from_email: string | null;
  from_name: string | null;
  domain: string | null;
  domain_verified: boolean | null;
  is_default: boolean | null;
  resend_api_key_masked: string | null;
  created_at: string;
  updated_at: string;
}

interface GmailConnectionOption {
  id: string;
  email: string;
}

export function EmailProviderSettings({ slug }: EmailProviderSettingsProps) {
  const [configs, setConfigs] = useState<EmailSendConfig[]>([]);
  const [gmailConnections, setGmailConnections] = useState<GmailConnectionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingConfigId, setVerifyingConfigId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConfig, setDeletingConfig] = useState<EmailSendConfig | null>(null);

  // Add form state
  const [newProvider, setNewProvider] = useState<'gmail' | 'resend'>('resend');
  const [newGmailConnectionId, setNewGmailConnectionId] = useState('');
  const [newResendApiKey, setNewResendApiKey] = useState('');
  const [newFromEmail, setNewFromEmail] = useState('');
  const [newFromName, setNewFromName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newIsDefault, setNewIsDefault] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${slug}/settings/email-providers`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setConfigs(data.configs ?? []);
    } catch {
      toast.error('Failed to load email provider settings');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const fetchGmailConnections = useCallback(async () => {
    try {
      const response = await fetch(`/api/gmail/connections?slug=${slug}`);
      if (!response.ok) return;
      const data = await response.json();
      setGmailConnections(
        (data.connections ?? []).map((c: { id: string; email: string }) => ({
          id: c.id,
          email: c.email,
        }))
      );
    } catch {
      // Gmail connections are optional
    }
  }, [slug]);

  useEffect(() => {
    fetchConfigs();
    fetchGmailConnections();
  }, [fetchConfigs, fetchGmailConnections]);

  function resetAddForm() {
    setNewProvider('resend');
    setNewGmailConnectionId('');
    setNewResendApiKey('');
    setNewFromEmail('');
    setNewFromName('');
    setNewDomain('');
    setNewIsDefault(false);
  }

  async function handleAdd() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        provider: newProvider,
        is_default: newIsDefault || (configs.length === 0 && newProvider === 'gmail'),
      };

      if (newProvider === 'gmail') {
        body.gmail_connection_id = newGmailConnectionId || null;
        // from_email from the selected Gmail connection
        const conn = gmailConnections.find((c) => c.id === newGmailConnectionId);
        body.from_email = conn?.email ?? null;
      } else {
        body.resend_api_key = newResendApiKey;
        body.from_email = newFromEmail;
        body.from_name = newFromName;
        body.domain = newDomain;
      }

      const response = await fetch(`/api/projects/${slug}/settings/email-providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add provider');
      }

      toast.success('Email provider added');
      setAddDialogOpen(false);
      resetAddForm();
      fetchConfigs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add provider');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingConfig) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${slug}/settings/email-providers`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingConfig.id }),
      });

      if (!response.ok) throw new Error('Failed to delete');

      toast.success('Email provider removed');
      setDeleteDialogOpen(false);
      setDeletingConfig(null);
      fetchConfigs();
    } catch {
      toast.error('Failed to remove provider');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(configId: string) {
    try {
      const response = await fetch(`/api/projects/${slug}/settings/email-providers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: configId, is_default: true }),
      });

      if (!response.ok) throw new Error('Failed to update');
      toast.success('Default provider updated');
      fetchConfigs();
    } catch {
      toast.error('Failed to set default provider');
    }
  }

  async function handleVerifyDomain(configId: string) {
    setVerifyingConfigId(configId);
    try {
      const response = await fetch(`/api/projects/${slug}/settings/email-providers/verify-domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_id: configId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify domain');
      }

      if (data.verified) {
        toast.success('Domain verified');
      } else if (Array.isArray(data.records) && data.records.length > 0) {
        toast.error('Domain is not verified yet. Finish the DNS records shown in Resend and retry.');
      } else {
        toast.error(data.error || 'Domain is not verified yet.');
      }

      fetchConfigs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to verify domain');
    } finally {
      setVerifyingConfigId(null);
    }
  }

  function getProviderLabel(config: EmailSendConfig) {
    if (config.provider === 'gmail') {
      return config.gmail_email || 'Gmail';
    }
    const fromDisplay = config.from_name
      ? `${config.from_name} <${config.from_email}>`
      : config.from_email;
    return fromDisplay || 'Resend';
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Providers</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Email Providers</CardTitle>
            <CardDescription>
              Configure how emails are sent from this project. Use Gmail for personal outreach
              or Resend for branded emails from a custom domain.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              resetAddForm();
              setAddDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Provider
          </Button>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No email providers configured. Broadcasts will use the sender&apos;s personal Gmail connection.
            </p>
          ) : (
            <div className="space-y-3">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {getProviderLabel(config)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {config.provider === 'gmail' ? 'Gmail' : 'Resend'}
                        </Badge>
                        {config.is_default && (
                          <Badge variant="default" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </div>
                      {config.provider === 'resend' && config.domain && (
                        <div className="flex items-center gap-1 mt-1">
                          {config.domain_verified ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {config.domain}
                            {config.domain_verified ? ' — verified' : ' — not verified'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                    <div className="flex items-center gap-2">
                    {config.provider === 'resend' && !config.domain_verified && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleVerifyDomain(config.id)}
                        disabled={verifyingConfigId === config.id}
                        title="Check domain verification"
                      >
                        {verifyingConfigId === config.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    {!config.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(config.id)}
                        disabled={config.provider === 'resend' && !config.domain_verified}
                        title="Set as default"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setDeletingConfig(config);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Provider Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { if (!open) resetAddForm(); setAddDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Email Provider</DialogTitle>
            <DialogDescription>
              Choose a provider for sending emails from this project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={newProvider} onValueChange={(v) => setNewProvider(v as 'gmail' | 'resend')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resend">Resend (custom domain)</SelectItem>
                  <SelectItem value="gmail">Gmail (personal account)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newProvider === 'gmail' ? (
              <div className="space-y-2">
                <Label>Gmail Connection</Label>
                {gmailConnections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No Gmail connections found. Connect Gmail first in the Integrations tab.
                  </p>
                ) : (
                  <Select value={newGmailConnectionId} onValueChange={setNewGmailConnectionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a Gmail account" />
                    </SelectTrigger>
                    <SelectContent>
                      {gmailConnections.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Resend API Key</Label>
                  <Input
                    type="password"
                    placeholder="re_..."
                    value={newResendApiKey}
                    onChange={(e) => setNewResendApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Get your API key from resend.com/api-keys
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Input
                    placeholder="yourdomain.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input
                    type="email"
                    placeholder="hello@yourdomain.com"
                    value={newFromEmail}
                    onChange={(e) => setNewFromEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Name (optional)</Label>
                  <Input
                    placeholder="Your Organization"
                    value={newFromName}
                    onChange={(e) => setNewFromName(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={
                saving ||
                (newProvider === 'gmail' && !newGmailConnectionId) ||
                (newProvider === 'resend' && (!newResendApiKey || !newFromEmail || !newDomain))
              }
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Email Provider</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the email provider configuration. Broadcasts using this
              provider will fall back to the default.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
