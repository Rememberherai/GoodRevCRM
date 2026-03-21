'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface ComplianceRecord {
  grant_id: string;
  grant_name: string;
  status: string;
  amount_awarded: number | null;
  amount_requested: number | null;
  total_spend: number;
  remaining_budget: number;
  budget_utilization_pct: number;
  unduplicated_participants: number;
  total_hours_delivered: number;
  contribution_count: number;
}

function formatCurrency(amount: number | null) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

export function GrantComplianceCard({ grantId }: { grantId?: string }) {
  const { slug } = useParams<{ slug: string }>();
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = grantId
        ? `/api/projects/${slug}/community/reports/grant-compliance?grant_id=${grantId}`
        : `/api/projects/${slug}/community/reports/grant-compliance`;
      const res = await fetch(url);
      const json = await res.json() as { compliance?: ComplianceRecord[] };
      setRecords(json.compliance ?? []);
    } catch {
      // silently fail — compliance is supplementary
    } finally {
      setIsLoading(false);
    }
  }, [slug, grantId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Grant Compliance</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grant Compliance</CardTitle>
        <CardDescription>
          Budget utilization, participants, and hours for {grantId ? 'this grant' : 'all awarded grants'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No compliance data available yet.
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((r) => (
              <div key={r.grant_id} className="rounded-lg border p-4 space-y-3">
                {!grantId && (
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{r.grant_name}</h4>
                    <Badge variant="secondary">{r.status}</Badge>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Awarded</p>
                    <p className="font-medium">{formatCurrency(r.amount_awarded)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Spent</p>
                    <p className="font-medium">{formatCurrency(r.total_spend)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Remaining</p>
                    <p className={`font-medium ${r.remaining_budget < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                      {formatCurrency(r.remaining_budget)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Utilization</p>
                    <p className="font-medium">{r.budget_utilization_pct}%</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      r.budget_utilization_pct > 100
                        ? 'bg-red-500'
                        : r.budget_utilization_pct > 80
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(r.budget_utilization_pct, 100)}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Unduplicated Participants</p>
                    <p className="text-lg font-bold">{r.unduplicated_participants.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Hours Delivered</p>
                    <p className="text-lg font-bold">{r.total_hours_delivered.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
