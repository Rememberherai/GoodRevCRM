'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, UserPlus, Copy, Check, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  FormDescription,
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { inviteMemberSchema } from '@/lib/validators/user';
import type { z } from 'zod';

type FormValues = z.infer<typeof inviteMemberSchema>;

interface InviteResult {
  invite_url: string;
  email: string;
}

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (data: FormValues) => Promise<InviteResult>;
}

export function InviteMemberDialog({ open, onOpenChange, onInvite }: InviteMemberDialogProps) {
  const [loading, setLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      email: '',
      role: 'member',
    },
  });

  const handleSubmit = async (data: FormValues) => {
    setLoading(true);
    try {
      const result = await onInvite(data);
      setInviteResult(result);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (inviteResult?.invite_url) {
      await navigator.clipboard.writeText(inviteResult.invite_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state when dialog closes
      setInviteResult(null);
      setCopied(false);
      form.reset();
    }
    onOpenChange(isOpen);
  };

  // Show success state with invite link
  if (inviteResult) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Invitation Created
            </DialogTitle>
            <DialogDescription>
              Share this link with {inviteResult.email} to invite them to the project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <Link className="h-4 w-4" />
              <AlertDescription className="ml-2">
                <strong>Important:</strong> Copy and send this link to the person you&apos;re inviting.
                They&apos;ll need to sign in with the email address <strong>{inviteResult.email}</strong> to accept.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">Invite Link</label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={inviteResult.invite_url}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This link expires in 7 days.
              </p>
            </div>

            <div className="rounded-lg border p-4 bg-muted/50">
              <h4 className="text-sm font-medium mb-2">Next Steps</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Copy the invite link above</li>
                <li>Send it to {inviteResult.email} via email, Slack, or any messaging app</li>
                <li>They click the link and sign in with Google</li>
                <li>Once accepted, they&apos;ll appear in your team members list</li>
              </ol>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setInviteResult(null);
                  form.reset();
                }}
              >
                Invite Another
              </Button>
              <Button type="button" onClick={() => handleClose(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Initial form state
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Create an invitation link to add a new member to your project.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="colleague@company.com"
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    The invitee must sign in with this exact email to accept
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div>
                          <p className="font-medium">Admin</p>
                          <p className="text-xs text-muted-foreground">
                            Can manage settings, members, and all data
                          </p>
                        </div>
                      </SelectItem>
                      <SelectItem value="member">
                        <div>
                          <p className="font-medium">Member</p>
                          <p className="text-xs text-muted-foreground">
                            Can create, edit, and delete data
                          </p>
                        </div>
                      </SelectItem>
                      <SelectItem value="viewer">
                        <div>
                          <p className="font-medium">Viewer</p>
                          <p className="text-xs text-muted-foreground">
                            Can only view data, no editing
                          </p>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Invitation'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
