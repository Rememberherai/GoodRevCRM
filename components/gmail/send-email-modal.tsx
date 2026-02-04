'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const sendEmailFormSchema = z.object({
  from_connection_id: z.string().min(1, 'Select a Gmail account'),
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required'),
  body_html: z.string().min(1, 'Email body is required'),
});

type SendEmailFormData = z.infer<typeof sendEmailFormSchema>;

interface GmailConnectionOption {
  id: string;
  email: string;
  status: string;
}

interface SendEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  defaultTo?: string;
  personId?: string;
  organizationId?: string;
  opportunityId?: string;
  rfpId?: string;
  onSuccess?: () => void;
}

export function SendEmailModal({
  open,
  onOpenChange,
  projectSlug,
  defaultTo = '',
  personId,
  organizationId,
  opportunityId,
  rfpId,
  onSuccess,
}: SendEmailModalProps) {
  const [connections, setConnections] = useState<GmailConnectionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const form = useForm<SendEmailFormData>({
    resolver: zodResolver(sendEmailFormSchema),
    defaultValues: {
      from_connection_id: '',
      to: defaultTo,
      subject: '',
      body_html: '',
    },
  });

  // Fetch Gmail connections
  useEffect(() => {
    const fetchConnections = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/gmail/connections');
        if (response.ok) {
          const data = await response.json();
          const activeConnections = data.connections.filter(
            (c: GmailConnectionOption) => c.status === 'connected'
          );
          setConnections(activeConnections);

          // Auto-select if only one connection
          if (activeConnections.length === 1) {
            form.setValue('from_connection_id', activeConnections[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching connections:', error);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchConnections();
      form.setValue('to', defaultTo);
    }
  }, [open, defaultTo, form]);

  const onSubmit = async (data: SendEmailFormData) => {
    setSending(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          person_id: personId,
          organization_id: organizationId,
          opportunity_id: opportunityId,
          rfp_id: rfpId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? 'Failed to send email');
      }

      toast.success('Email sent successfully');
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
          <DialogDescription>
            Compose and send an email with tracking enabled
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : connections.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No Gmail accounts connected</p>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your Gmail account in settings to send emails
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                onOpenChange(false);
                window.location.href = `/settings`;
              }}
            >
              Go to Settings
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="from_connection_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Gmail account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {connections.map((connection) => (
                          <SelectItem key={connection.id} value={connection.id}>
                            {connection.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <FormControl>
                      <Input placeholder="recipient@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Email subject" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="body_html"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Write your message..."
                        className="min-h-[200px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={sending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={sending}>
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Email
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
