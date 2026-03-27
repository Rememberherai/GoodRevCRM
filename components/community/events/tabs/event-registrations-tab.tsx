'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Printer, QrCode, Ticket } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface TicketInfo {
  id: string;
  qr_code: string | null;
  checked_in_at: string | null;
  attendee_name: string | null;
  attendee_email: string | null;
  ticket_type_id: string;
  event_ticket_types?: { name: string } | null;
}

interface Registration {
  id: string;
  registrant_name: string;
  registrant_email: string;
  status: string;
  checked_in_at: string | null;
  created_at: string;
  event_registration_tickets: TicketInfo[];
}

interface EventRegistrationsTabProps {
  projectSlug: string;
  eventId: string;
}

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  confirmed: 'default',
  waitlisted: 'outline',
  pending_approval: 'secondary',
  pending_waiver: 'secondary',
  cancelled: 'destructive',
};

export function EventRegistrationsTab({ projectSlug, eventId }: EventRegistrationsTabProps) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ticketDialogReg, setTicketDialogReg] = useState<Registration | null>(null);

  const apiBase = `/api/projects/${projectSlug}/events/${eventId}`;

  const loadRegistrations = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase}/registrations?limit=100`);
      const data = await res.json();
      if (res.ok) setRegistrations(data.registrations ?? []);
    } catch {
      console.error('Failed to load registrations');
    } finally {
      setIsLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { void loadRegistrations(); }, [loadRegistrations]);

  async function handleUpdateStatus(regId: string, status: string) {
    try {
      const res = await fetch(`${apiBase}/registrations/${regId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      toast.success(`Registration ${status}`);
      void loadRegistrations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  async function handleCheckIn(regId: string) {
    try {
      const res = await fetch(`${apiBase}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: regId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      toast.success('Checked in');
      void loadRegistrations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to check in');
    }
  }

  async function handleResendConfirmation(regId: string) {
    try {
      const res = await fetch(`${apiBase}/registrations/${regId}/resend-confirmation`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      toast.success('Confirmation email sent');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registrations</CardTitle>
        <CardDescription>All registrations for this event.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : registrations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No registrations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">Name</th>
                  <th className="px-2 py-2 text-left font-medium">Email</th>
                  <th className="px-2 py-2 text-left font-medium">Status</th>
                  <th className="px-2 py-2 text-left font-medium">Checked In</th>
                  <th className="px-2 py-2 text-center font-medium">Tickets</th>
                  <th className="px-2 py-2 text-left font-medium">Registered</th>
                  <th className="px-2 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map(reg => (
                  <tr key={reg.id} className="border-b last:border-0">
                    <td className="px-2 py-2">{reg.registrant_name}</td>
                    <td className="px-2 py-2 text-muted-foreground">{reg.registrant_email}</td>
                    <td className="px-2 py-2">
                      <Badge variant={statusBadgeVariant[reg.status] ?? 'secondary'}>
                        {reg.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-2 py-2">
                      {reg.checked_in_at ? new Date(reg.checked_in_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {reg.event_registration_tickets.length > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => setTicketDialogReg(reg)}
                        >
                          <Ticket className="h-3 w-3" />
                          {reg.event_registration_tickets.length}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">0</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {new Date(reg.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {reg.status === 'pending_approval' && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(reg.id, 'confirmed')}>
                              Approve
                            </DropdownMenuItem>
                          )}
                          {(reg.status === 'confirmed' || reg.status === 'pending_approval') && !reg.checked_in_at && (
                            <DropdownMenuItem onClick={() => handleCheckIn(reg.id)}>
                              Check In
                            </DropdownMenuItem>
                          )}
                          {reg.status === 'confirmed' && (
                            <DropdownMenuItem onClick={() => handleResendConfirmation(reg.id)}>
                              Resend Confirmation
                            </DropdownMenuItem>
                          )}
                          {reg.status !== 'cancelled' && !reg.checked_in_at && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleUpdateStatus(reg.id, 'cancelled')}
                            >
                              Cancel
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Ticket QR Code Dialog */}
      <TicketQrDialog
        registration={ticketDialogReg}
        onClose={() => setTicketDialogReg(null)}
      />
    </Card>
  );
}

function TicketQrDialog({ registration, onClose }: { registration: Registration | null; onClose: () => void }) {
  const tickets = registration?.event_registration_tickets ?? [];
  const ticketListRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    if (!registration || tickets.length === 0 || !ticketListRef.current) return;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const win = window.open('', '_blank');
    if (!win) return;

    // Grab rendered SVG QR codes from the DOM
    const svgElements = ticketListRef.current.querySelectorAll('svg');
    const ticketHtml = tickets.map((t, i) => {
      const name = t.attendee_name || registration.registrant_name;
      const qrSvg = svgElements[i]?.outerHTML ?? '';
      const checkedIn = t.checked_in_at ? `<div class="checked-in">Checked in ${new Date(t.checked_in_at).toLocaleString()}</div>` : '';
      return `<div class="ticket">
        <div class="ticket-num">Ticket ${i + 1}</div>
        ${qrSvg}
        <div class="qr-code">${esc(t.qr_code ?? '')}</div>
        <div class="name">${esc(name)}</div>
        ${checkedIn}
      </div>`;
    }).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>Tickets — ${esc(registration.registrant_name)}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin-bottom: 16px; }
  .tickets { display: flex; flex-wrap: wrap; gap: 24px; }
  .ticket { border: 1px solid #ddd; border-radius: 8px; padding: 16px; width: 220px; text-align: center; }
  .ticket-num { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .qr-code { font-family: monospace; font-size: 10px; color: #666; word-break: break-all; margin: 8px 0; }
  .name { font-weight: 600; font-size: 13px; }
  .checked-in { font-size: 11px; color: #16a34a; margin-top: 4px; }
  svg { margin-bottom: 8px; }
</style>
</head><body>
  <h1>Tickets for ${esc(registration.registrant_name)}</h1>
  <div class="tickets">${ticketHtml}</div>
  <script>window.print();<\/script>
</body></html>`);
    win.document.close();
  }, [registration, tickets]);

  return (
    <Dialog open={!!registration} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Tickets
          </DialogTitle>
          <DialogDescription>
            {registration?.registrant_name} — {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-1 h-3 w-3" />Print Tickets
          </Button>
        </div>

        <div ref={ticketListRef} className="flex-1 overflow-y-auto space-y-4 pr-1">
          {tickets.map((ticket, i) => (
            <div key={ticket.id} className="rounded-lg border p-4 flex flex-col items-center gap-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Ticket {i + 1}
                {ticket.event_ticket_types?.name && ` — ${ticket.event_ticket_types.name}`}
              </div>
              {ticket.qr_code && (
                <QRCodeSVG value={`${window.location.origin}/events/ticket/${ticket.qr_code}`} size={140} />
              )}
              <code className="text-[10px] text-muted-foreground select-all break-all text-center">
                {ticket.qr_code ?? 'No QR code'}
              </code>
              {(ticket.attendee_name || ticket.attendee_email) && (
                <div className="text-sm text-center">
                  {ticket.attendee_name && <p className="font-medium">{ticket.attendee_name}</p>}
                  {ticket.attendee_email && <p className="text-xs text-muted-foreground">{ticket.attendee_email}</p>}
                </div>
              )}
              {ticket.checked_in_at ? (
                <Badge variant="outline" className="text-green-700 dark:text-green-400">
                  Checked in {new Date(ticket.checked_in_at).toLocaleString()}
                </Badge>
              ) : (
                <Badge variant="secondary">Not checked in</Badge>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
