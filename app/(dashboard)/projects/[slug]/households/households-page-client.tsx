'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { NewHouseholdDialog } from '@/components/community/households/new-household-dialog';
import { RiskExplainability } from '@/components/community/households/risk-explainability';

interface HouseholdListItem {
  id: string;
  name: string;
  address_city: string | null;
  address_state: string | null;
  household_size: number | null;
  member_count: number;
  updated_at: string;
}

interface HouseholdListResponse {
  households: HouseholdListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface RiskScoreRecord {
  householdId: string;
  householdName?: string | null;
  score: number;
  tier: 'low' | 'medium' | 'high';
  contributions: Array<{
    key: string;
    label: string;
    weight: number;
    active: boolean;
  }>;
}

export function HouseholdsPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [households, setHouseholds] = useState<HouseholdListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [riskScores, setRiskScores] = useState<Record<string, RiskScoreRecord>>({});
  const [riskEnabled, setRiskEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;

    fetch(`/api/projects/${slug}/settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!isMounted) return;
        setRiskEnabled(Boolean(d?.settings?.risk_index_enabled));
      })
      .catch(() => {
        if (!isMounted) return;
        setRiskEnabled(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const loadHouseholds = useCallback(async (nextPage: number, nextSearch: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: '20',
      });

      if (nextSearch.trim()) {
        params.set('search', nextSearch.trim());
      }

      const response = await fetch(`/api/projects/${slug}/households?${params.toString()}`);
      const data = await response.json() as HouseholdListResponse | { error: string };

      if (!response.ok) {
        throw new Error('error' in data ? data.error : 'Failed to load households');
      }

      const payload = data as HouseholdListResponse;
      setHouseholds(payload.households);
      setPage(payload.pagination.page);
      setTotalPages(Math.max(1, payload.pagination.totalPages));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load households');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadHouseholds(1, search);
  }, [loadHouseholds, search]);

  useEffect(() => {
    if (!riskEnabled) return;
    const loadRiskScores = async () => {
      const response = await fetch(`/api/projects/${slug}/community/risk-index`);
      if (!response.ok) return;
      const data = await response.json() as { scores?: RiskScoreRecord[] };
      setRiskScores(Object.fromEntries((data.scores ?? []).map((score) => [score.householdId, score])));
    };

    void loadRiskScores();
  }, [slug, riskEnabled]);

  const emptyMessage = useMemo(() => {
    if (search.trim()) {
      return 'No households matched your search.';
    }
    return 'No households yet. Create one to start tracking members, intake, and community activity.';
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div />
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Household
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Household Directory</CardTitle>
            <CardDescription>
              Search by household name or address.
            </CardDescription>
          </div>
          <form
            className="flex w-full max-w-md items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(query);
            }}
          >
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search households"
            />
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </CardHeader>
        <CardContent className="space-y-4">

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <div className="h-5 w-48 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : households.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            <div className="space-y-3">
              {households.map((household) => (
                <div key={household.id} className="rounded-lg border p-4 transition-colors hover:bg-accent">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <Link
                      href={`/projects/${slug}/households/${household.id}`}
                      className="block flex-1 space-y-1"
                    >
                      <div className="font-medium">{household.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {[household.address_city, household.address_state].filter(Boolean).join(', ') || 'No location yet'}
                      </div>
                    </Link>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{household.member_count} members</Badge>
                      {household.household_size !== null && (
                        <Badge variant="outline">Size {household.household_size}</Badge>
                      )}
                      {riskEnabled && (() => {
                        const riskScore = riskScores[household.id];
                        if (!riskScore) return null;
                        return (
                          <>
                            <Badge variant={riskScore.tier === 'high' ? 'destructive' : 'secondary'}>
                              Risk {riskScore.score}
                            </Badge>
                            <RiskExplainability score={riskScore} />
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => void loadHouseholds(page - 1, search)}
              >
                Previous
              </Button>
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => void loadHouseholds(page + 1, search)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <NewHouseholdDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCreated={() => void loadHouseholds(1, search)}
      />
    </div>
  );
}
