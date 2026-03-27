'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Users, Check, KeyRound, Monitor, Mail, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EmployeePerson {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  is_employee: boolean;
  user_id: string | null;
  pin_set?: boolean;
}

interface SetPinDialogState {
  open: boolean;
  personId: string;
  personName: string;
  pin: string;
  saving: boolean;
}

interface InviteDialogState {
  open: boolean;
  personId: string;
  personName: string;
  email: string;
  sending: boolean;
  inviteUrl: string | null;
}

const emptyPinDialog: SetPinDialogState = {
  open: false,
  personId: '',
  personName: '',
  pin: '',
  saving: false,
};

const emptyInviteDialog: InviteDialogState = {
  open: false,
  personId: '',
  personName: '',
  email: '',
  sending: false,
  inviteUrl: null,
};

export function EmployeesPageClient() {
  const params = useParams();
  const slug = params.slug as string;

  const [employees, setEmployees] = useState<EmployeePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinDialog, setPinDialog] = useState<SetPinDialogState>(emptyPinDialog);
  const [inviteDialog, setInviteDialog] = useState<InviteDialogState>(emptyInviteDialog);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/people?is_employee=true&limit=200`);
      const data = await res.json() as { people?: EmployeePerson[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to load employees');
      setEmployees(data.people ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  function displayName(p: EmployeePerson) {
    return [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unnamed';
  }

  function openPinDialog(person: EmployeePerson) {
    setPinDialog({
      open: true,
      personId: person.id,
      personName: displayName(person),
      pin: '',
      saving: false,
    });
  }

  async function savePin() {
    if (!pinDialog.pin.match(/^\d{4}$/)) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }
    setPinDialog((d) => ({ ...d, saving: true }));
    try {
      const res = await fetch(`/api/projects/${slug}/employees/${pinDialog.personId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kiosk_pin: pinDialog.pin }),
      });
      const data = await res.json() as { employee?: { pin_set: boolean }; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to set PIN');
      toast.success('PIN updated');
      setPinDialog(emptyPinDialog);
      await loadEmployees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set PIN');
      setPinDialog((d) => ({ ...d, saving: false }));
    }
  }

  async function clearPin(personId: string) {
    try {
      const res = await fetch(`/api/projects/${slug}/employees/${personId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kiosk_pin: null }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to clear PIN');
      toast.success('PIN cleared');
      await loadEmployees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear PIN');
    }
  }

  function openInviteDialog(person: EmployeePerson) {
    setInviteDialog({
      open: true,
      personId: person.id,
      personName: displayName(person),
      email: person.email ?? '',
      sending: false,
      inviteUrl: null,
    });
  }

  async function sendPortalInvite() {
    if (!inviteDialog.email) {
      toast.error('Email is required to send an invite');
      return;
    }
    setInviteDialog((d) => ({ ...d, sending: true }));
    try {
      const res = await fetch(`/api/projects/${slug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteDialog.email, role: 'staff' }),
      });
      const data = await res.json() as { invite_url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to send invite');
      setInviteDialog((d) => ({ ...d, sending: false, inviteUrl: data.invite_url ?? null }));
      toast.success('Portal invite created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite');
      setInviteDialog((d) => ({ ...d, sending: false }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hourly workers with clock-in/out access. Manage PINs for kiosk punch-in.
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/kiosk/${slug}`} target="_blank" rel="noopener noreferrer">
            <Monitor className="mr-2 h-4 w-4" />
            Open Kiosk
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Employee Roster</CardTitle>
              <CardDescription>
                People with employee access in this project. Mark additional people as employees from their contact record.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-muted" />
          ) : employees.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No employees yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open a contact record, enable &ldquo;Is Employee&rdquo;, and set a kiosk PIN.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-4 text-left font-medium">Name</th>
                    <th className="pb-2 pr-4 text-left font-medium">Email</th>
                    <th className="pb-2 pr-4 text-center font-medium">Portal Access</th>
                    <th className="pb-2 pr-4 text-center font-medium">Kiosk PIN</th>
                    <th className="pb-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map((emp) => {
                    const pinSet = emp.pin_set === true;
                    const hasPortal = emp.user_id != null;
                    return (
                      <tr key={emp.id}>
                        <td className="py-2 pr-4 font-medium">
                          <Link
                            href={`/projects/${slug}/employees/${emp.id}`}
                            className="hover:underline"
                          >
                            {displayName(emp)}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">{emp.email ?? '—'}</td>
                        <td className="py-2 pr-4 text-center">
                          {hasPortal ? (
                            <Check className="mx-auto h-4 w-4 text-green-600" />
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => openInviteDialog(emp)}
                            >
                              <Mail className="mr-1 h-3 w-3" />
                              Invite
                            </Button>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-center">
                          {pinSet ? (
                            <Badge variant="outline" className="text-xs text-green-700 border-green-200">
                              Set
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => openPinDialog(emp)}
                            >
                              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                              {pinSet ? 'Reset PIN' : 'Set PIN'}
                            </Button>
                            {pinSet && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-destructive"
                                onClick={() => void clearPin(emp.id)}
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Set PIN dialog */}
      <Dialog open={pinDialog.open} onOpenChange={(open) => !open && setPinDialog(emptyPinDialog)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Kiosk PIN</DialogTitle>
            <DialogDescription>
              Assign a 4-digit PIN to <strong>{pinDialog.personName}</strong> for kiosk clock-in. The raw PIN is never stored.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pin-input">4-Digit PIN</Label>
              <Input
                id="pin-input"
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                placeholder="••••"
                value={pinDialog.pin}
                onChange={(e) => setPinDialog((d) => ({ ...d, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialog(emptyPinDialog)} disabled={pinDialog.saving}>
              Cancel
            </Button>
            <Button onClick={() => void savePin()} disabled={pinDialog.saving || pinDialog.pin.length !== 4}>
              Save PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite to Portal dialog */}
      <Dialog open={inviteDialog.open} onOpenChange={(open) => !open && setInviteDialog(emptyInviteDialog)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite to Portal</DialogTitle>
            <DialogDescription>
              Send <strong>{inviteDialog.personName}</strong> a portal invite so they can log in, view schedules, and access their employee dashboard.
            </DialogDescription>
          </DialogHeader>
          {inviteDialog.inviteUrl ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Invite created! Share this link with {inviteDialog.personName}:
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={inviteDialog.inviteUrl} className="text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(inviteDialog.inviteUrl!);
                    toast.success('Link copied');
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This link expires in 7 days. Once accepted, their portal access will activate automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="employee@example.com"
                  value={inviteDialog.email}
                  onChange={(e) => setInviteDialog((d) => ({ ...d, email: e.target.value }))}
                  autoFocus
                />
              </div>
              {!inviteDialog.email && (
                <p className="text-xs text-amber-600">
                  This person has no email on file. Enter their email to send the invite.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            {inviteDialog.inviteUrl ? (
              <Button onClick={() => { setInviteDialog(emptyInviteDialog); void loadEmployees(); }}>
                Done
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setInviteDialog(emptyInviteDialog)} disabled={inviteDialog.sending}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void sendPortalInvite()}
                  disabled={inviteDialog.sending || !inviteDialog.email}
                >
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  {inviteDialog.sending ? 'Sending…' : 'Send Invite'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
