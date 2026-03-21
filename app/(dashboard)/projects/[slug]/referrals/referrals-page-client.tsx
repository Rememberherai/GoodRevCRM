'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, SendToBack } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NewReferralDialog } from '@/components/community/referrals/new-referral-dialog';

interface ReferralRecord {
  id: string;
  service_type: string;
  status: string;
  outcome: string | null;
  notes: string | null;
  updated_at: string;
  person?: { first_name: string | null; last_name: string | null } | null;
  household?: { name: string | null } | null;
  partner?: { name: string | null } | null;
}

export function ReferralsPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadReferrals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const search = new URLSearchParams();
      if (statusFilter !== 'all') {
        search.set('status', statusFilter);
      }
      const response = await fetch(`/api/projects/${slug}/referrals?${search.toString()}`);
      const data = await response.json() as { referrals?: ReferralRecord[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load referrals');
      }
      setReferrals(data.referrals ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load referrals');
    } finally {
      setIsLoading(false);
    }
  }, [slug, statusFilter]);

  useEffect(() => {
    void loadReferrals();
  }, [loadReferrals]);

  const statuses = useMemo(() => ['all', 'submitted', 'acknowledged', 'in_progress', 'completed', 'closed'], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <SendToBack className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Referrals</h2>
            <p className="text-sm text-muted-foreground">
              Closed-loop tracking for services routed to partner organizations.
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Referral
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Referral Pipeline</CardTitle>
            <CardDescription>Monitor partner handoffs, in-progress services, and closed-loop outcomes.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status === 'all' ? 'All' : status.replace(/_/g, ' ')}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-lg bg-muted" />)
          ) : referrals.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">No referrals match this filter yet.</div>
          ) : (
            referrals.map((referral) => (
              <div key={referral.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">{referral.service_type}</div>
                    <div className="text-sm text-muted-foreground">
                      {[referral.household?.name, [referral.person?.first_name, referral.person?.last_name].filter(Boolean).join(' '), referral.partner?.name].filter(Boolean).join(' • ') || 'No linked records'}
                    </div>
                    {(referral.notes || referral.outcome) && (
                      <div className="text-sm text-muted-foreground">
                        {referral.outcome || referral.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={referral.status === 'completed' ? 'default' : 'secondary'}>
                      {referral.status.replace(/_/g, ' ')}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {new Date(referral.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <NewReferralDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => void loadReferrals()}
      />
    </div>
  );
}
