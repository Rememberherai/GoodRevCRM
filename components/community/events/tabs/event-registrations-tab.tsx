'use client';

import { useCallback, useEffect, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface Registration {
  id: string;
  registrant_name: string;
  registrant_email: string;
  status: string;
  checked_in_at: string | null;
  created_at: string;
  event_registration_tickets: { id: string; qr_code: string | null }[];
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
    </Card>
  );
}
