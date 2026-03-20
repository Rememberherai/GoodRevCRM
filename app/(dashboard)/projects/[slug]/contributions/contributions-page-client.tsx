'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { HandCoins, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DonationEntry } from '@/components/community/contributions/donation-entry';
import { TimeLogEntry } from '@/components/community/contributions/time-log-entry';

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

export function ContributionsPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [donationsOpen, setDonationsOpen] = useState(false);
  const [timeLogOpen, setTimeLogOpen] = useState(false);
  const [contributions, setContributions] = useState<ContributionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContributions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/contributions?limit=100`);
      const data = await response.json() as { contributions?: ContributionRecord[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load contributions');
      }
      setContributions(data.contributions ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load contributions');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadContributions();
  }, [loadContributions]);

  const donations = contributions.filter((contribution) => ['monetary', 'in_kind', 'grant'].includes(contribution.type));
  const timeLogs = contributions.filter((contribution) => ['volunteer_hours', 'service'].includes(contribution.type));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HandCoins className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Contributions</h2>
            <p className="text-sm text-muted-foreground">Track donations, grants, volunteer hours, and service activity.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTimeLogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Log Time
          </Button>
          <Button onClick={() => setDonationsOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Donation
          </Button>
        </div>
      </div>

      <Tabs defaultValue="donations">
        <TabsList>
          <TabsTrigger value="donations">Donations</TabsTrigger>
          <TabsTrigger value="time-log">Time Log</TabsTrigger>
        </TabsList>

        <TabsContent value="donations" className="pt-4">
          <ContributionListCard
            title="Donations"
            description="Monetary gifts, in-kind support, and grant revenue."
            items={donations}
            isLoading={isLoading}
            error={error}
          />
        </TabsContent>
        <TabsContent value="time-log" className="pt-4">
          <ContributionListCard
            title="Time Log"
            description="Volunteer hours and service delivery records."
            items={timeLogs}
            isLoading={isLoading}
            error={error}
          />
        </TabsContent>
      </Tabs>

      <DonationEntry open={donationsOpen} onOpenChange={setDonationsOpen} onCreated={() => void loadContributions()} />
      <TimeLogEntry open={timeLogOpen} onOpenChange={setTimeLogOpen} onCreated={() => void loadContributions()} />
    </div>
  );
}

function ContributionListCard({
  title,
  description,
  items,
  isLoading,
  error,
}: {
  title: string;
  description: string;
  items: ContributionRecord[];
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-lg bg-muted" />
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
                {item.hours !== null && <Badge variant="outline">{item.hours.toFixed(1)} hrs</Badge>}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
