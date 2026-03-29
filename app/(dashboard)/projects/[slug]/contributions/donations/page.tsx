'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DonationEntry } from '@/components/community/contributions/donation-entry';

interface ContributionRecord {
  id: string;
  type: string;
  status: string;
  date: string;
  description: string | null;
  value: number | null;
  hours: number | null;
  program?: { id: string; name: string } | null;
}

export default function DonationsSubtabPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ContributionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/contributions?limit=100`);
      const data = await response.json() as { contributions?: ContributionRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to load contributions');
      const all = data.contributions ?? [];
      setItems(all.filter((c) => ['monetary', 'in_kind', 'grant'].includes(c.type)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Donation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Donations</CardTitle>
          <CardDescription>Monetary gifts, in-kind support, and grant revenue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No records yet.
            </div>
          ) : items.map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{item.description || item.type.replaceAll('_', ' ')}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(item.date).toLocaleDateString()}
                    {item.program?.name ? ` • ${item.program.name}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{item.status}</Badge>
                  {item.value !== null && <Badge variant="outline">${item.value.toFixed(2)}</Badge>}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <DonationEntry open={open} onOpenChange={setOpen} onCreated={() => void load()} />
    </>
  );
}
