'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Phone, CheckCircle2, XCircle, AlertCircle, Copy, Check } from 'lucide-react';
import { telnyxConnectionSchema, type TelnyxConnectionInput } from '@/lib/validators/call';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

interface TelnyxSettingsPanelProps {
  slug: string;
}

export function TelnyxSettingsPanel({ slug }: TelnyxSettingsPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExistingConnection, setHasExistingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate webhook URL based on current origin
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/telnyx`
    : '';

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const form = useForm({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(telnyxConnectionSchema) as any,
    defaultValues: {
      api_key: '',
      call_control_app_id: '',
      sip_connection_id: '',
      sip_username: '',
      sip_password: '',
      phone_number: '',
      phone_number_id: '',
      record_calls: false,
      amd_enabled: false,
      caller_id_name: '',
    },
  });

  const fetchConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/telnyx`);
      if (!res.ok) return;

      const data = await res.json();
      if (data.connection) {
        setHasExistingConnection(true);
        setConnectionStatus(data.connection.status);
        form.reset({
          api_key: '••••••••••••••••', // Masked
          call_control_app_id: data.connection.call_control_app_id ?? '',
          sip_connection_id: data.connection.sip_connection_id ?? '',
          sip_username: data.connection.sip_username ?? '',
          sip_password: '', // Don't show
          phone_number: data.connection.phone_number ?? '',
          phone_number_id: data.connection.phone_number_id ?? '',
          record_calls: data.connection.record_calls ?? false,
          amd_enabled: data.connection.amd_enabled ?? false,
          caller_id_name: data.connection.caller_id_name ?? '',
        });
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [slug, form]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  const onSubmit = async (values: TelnyxConnectionInput) => {
    setIsSaving(true);
    try {
      // If API key is masked, user hasn't changed it — skip validation
      const isNewKey = values.api_key !== '••••••••••••••••';

      if (hasExistingConnection && !isNewKey) {
        // Only update settings
        const res = await fetch(`/api/projects/${slug}/telnyx`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            record_calls: values.record_calls,
            amd_enabled: values.amd_enabled,
            caller_id_name: values.caller_id_name || null,
            call_control_app_id: values.call_control_app_id || null,
            sip_connection_id: values.sip_connection_id || null,
            sip_username: values.sip_username || null,
            ...(values.sip_password ? { sip_password: values.sip_password } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to update settings');
        }

        toast.success('Phone settings updated');
      } else {
        // Create new connection
        const res = await fetch(`/api/projects/${slug}/telnyx`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to save connection');
        }

        toast.success('Telnyx connected successfully');
        setHasExistingConnection(true);
        setConnectionStatus('active');
      }

      fetchConnection();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/telnyx`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to disconnect');

      toast.success('Telnyx disconnected');
      setHasExistingConnection(false);
      setConnectionStatus(null);
      form.reset({
        api_key: '',
        call_control_app_id: '',
        sip_connection_id: '',
        sip_username: '',
        sip_password: '',
        phone_number: '',
        record_calls: false,
        amd_enabled: false,
        caller_id_name: '',
      });
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Telnyx Phone
              </CardTitle>
              <CardDescription>
                Configure click-to-dial calling with Telnyx VoIP
              </CardDescription>
            </div>
            {connectionStatus && (
              <Badge
                variant="secondary"
                className={
                  connectionStatus === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }
              >
                {connectionStatus === 'active' ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</>
                ) : (
                  <><XCircle className="h-3 w-3 mr-1" /> {connectionStatus}</>
                )}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="api_key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="KEY_..."
                      />
                    </FormControl>
                    <FormDescription>
                      Your Telnyx V2 API key from portal.telnyx.com
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="+12025551234"
                        />
                      </FormControl>
                      <FormDescription>
                        E.164 format
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="caller_id_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Caller ID Name</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} placeholder="Your Company" />
                      </FormControl>
                      <FormDescription>
                        Outbound caller name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="call_control_app_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Call Control Application ID</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} placeholder="e.g., 1293384261075731500" />
                    </FormControl>
                    <FormDescription>
                      From Voice → Call Control → Applications in Telnyx portal (required for making calls)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {webhookUrl && (
                <div className="border rounded-md p-4 space-y-2 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Webhook URL</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={copyWebhookUrl}
                      className="h-7 px-2"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <code className="block text-xs bg-background rounded p-2 break-all">
                    {webhookUrl}
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Add this URL in your Telnyx Call Control Application settings for call events (recordings, hangups, etc.)
                  </p>
                </div>
              )}

              <div className="border rounded-md p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertCircle className="h-4 w-4" />
                  WebRTC Credentials (for browser calling)
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="sip_username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SIP Username</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ''} placeholder="Username" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sip_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SIP Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            type="password"
                            placeholder={hasExistingConnection ? '(unchanged)' : 'Password'}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <FormField
                  control={form.control}
                  name="record_calls"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <FormLabel className="mb-0">Record Calls</FormLabel>
                        <FormDescription className="mt-0.5">
                          For WebRTC calls, enable recording on your Outbound Voice Profile in the Telnyx portal (Networking → Outbound Voice Profiles → Advanced Settings)
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amd_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <FormLabel className="mb-0">Answering Machine Detection</FormLabel>
                        <FormDescription className="mt-0.5">
                          Detect voicemail systems on outbound calls (97% accuracy)
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {hasExistingConnection ? 'Update Settings' : 'Connect'}
                </Button>
                {hasExistingConnection && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive"
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
