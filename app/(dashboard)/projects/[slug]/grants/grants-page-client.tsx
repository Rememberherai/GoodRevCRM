'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Award, Plus, List, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { NewGrantDialog } from '@/components/community/grants/new-grant-dialog';

interface GrantRecord {
  id: string;
  name: string;
  status: string;
  amount_requested: number | null;
  amount_awarded: number | null;
  loi_due_at: string | null;
  application_due_at: string | null;
  report_due_at: string | null;
  funder_organization_id: string | null;
  contact_person_id: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  funder?: { id: string; name: string } | null;
  contact?: { id: string; first_name: string | null; last_name: string | null } | null;
}

const GRANT_STATUSES = [
  { value: 'researching', label: 'Researching', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  { value: 'preparing', label: 'Preparing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  { value: 'submitted', label: 'Submitted', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  { value: 'under_review', label: 'Under Review', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  { value: 'awarded', label: 'Awarded', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  { value: 'declined', label: 'Declined', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
] as const;

function formatCurrency(amount: number | null) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusConfig(status: string) {
  return GRANT_STATUSES.find((s) => s.value === status) ?? GRANT_STATUSES[0];
}

function getNextDeadline(grant: GrantRecord) {
  const now = new Date();
  const deadlines = [
    { type: 'LOI', date: grant.loi_due_at },
    { type: 'Application', date: grant.application_due_at },
    { type: 'Report', date: grant.report_due_at },
  ].filter((d) => d.date && new Date(d.date) >= now);

  deadlines.sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
  return deadlines[0] ?? null;
}

function isOverdue(dateStr: string | null) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export default function GrantsPageClient() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  const fetchGrants = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/grants?limit=100`);
      const json = await res.json() as { grants?: GrantRecord[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to fetch grants');
      setGrants(json.grants ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch grants');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchGrants(); }, [fetchGrants]);

  const handleStatusChange = async (grantId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/grants/${grantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? 'Failed to update status');
      }
      await fetchGrants();
    } catch (err) {
      console.error('Failed to update grant status:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Grants</h2>
            <p className="text-sm text-muted-foreground">
              Track grant opportunities from research to award
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className="mr-1 h-4 w-4" />
            Pipeline
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="mr-1 h-4 w-4" />
            List
          </Button>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Grant
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-72 flex-shrink-0 rounded-xl" />
          ))}
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && (
        viewMode === 'kanban' ? (
          <KanbanView
            grants={grants}
            onStatusChange={handleStatusChange}
            onClickGrant={(id) => router.push(`/projects/${slug}/grants/${id}`)}
          />
        ) : (
          <ListView
            grants={grants}
            onClickGrant={(id) => router.push(`/projects/${slug}/grants/${id}`)}
          />
        )
      )}

      <NewGrantDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreated={fetchGrants}
      />
    </div>
  );
}

function KanbanView({
  grants,
  onStatusChange,
  onClickGrant,
}: {
  grants: GrantRecord[];
  onStatusChange: (id: string, status: string) => void;
  onClickGrant: (id: string) => void;
}) {
  // Only show pipeline statuses (not declined)
  const pipelineStatuses = GRANT_STATUSES.filter((s) => s.value !== 'declined');
  const declinedGrants = grants.filter((g) => g.status === 'declined');

  return (
    <div className="space-y-4">
      <div className="flex gap-4 overflow-x-auto pb-4">
        {pipelineStatuses.map((statusConfig) => {
          const columnGrants = grants.filter((g) => g.status === statusConfig.value);
          return (
            <div key={statusConfig.value} className="w-72 flex-shrink-0">
              <div className="mb-3 flex items-center gap-2">
                <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                <span className="text-sm text-muted-foreground">({columnGrants.length})</span>
              </div>
              <div className="space-y-3">
                {columnGrants.map((grant) => (
                  <GrantCard
                    key={grant.id}
                    grant={grant}
                    onStatusChange={onStatusChange}
                    onClick={() => onClickGrant(grant.id)}
                  />
                ))}
                {columnGrants.length === 0 && (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No grants
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {declinedGrants.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              Declined ({declinedGrants.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {declinedGrants.map((grant) => (
              <button
                key={grant.id}
                onClick={() => onClickGrant(grant.id)}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent"
              >
                <span className="font-medium">{grant.name}</span>
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(grant.amount_requested)}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GrantCard({
  grant,
  onStatusChange,
  onClick,
}: {
  grant: GrantRecord;
  onStatusChange: (id: string, status: string) => void;
  onClick: () => void;
}) {
  const nextDeadline = getNextDeadline(grant);
  const currentIdx = GRANT_STATUSES.findIndex((s) => s.value === grant.status);
  const nextStatus = currentIdx >= 0 && currentIdx < 3 ? GRANT_STATUSES[currentIdx + 1] : null;

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        <div>
          <h4 className="font-medium leading-tight">{grant.name}</h4>
          {grant.funder?.name && (
            <p className="text-sm text-muted-foreground mt-0.5">{grant.funder.name}</p>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Requested</span>
          <span className="font-medium">{formatCurrency(grant.amount_requested)}</span>
        </div>

        {grant.amount_awarded != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Awarded</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {formatCurrency(grant.amount_awarded)}
            </span>
          </div>
        )}

        {nextDeadline && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{nextDeadline.type}</span>
            <span className={isOverdue(nextDeadline.date) ? 'font-medium text-red-600 dark:text-red-400' : ''}>
              {formatDate(nextDeadline.date)}
            </span>
          </div>
        )}

        {nextStatus && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(grant.id, nextStatus.value);
            }}
          >
            Move to {nextStatus.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ListView({
  grants,
  onClickGrant,
}: {
  grants: GrantRecord[];
  onClickGrant: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Grants</CardTitle>
        <CardDescription>{grants.length} grant{grants.length !== 1 ? 's' : ''} total</CardDescription>
      </CardHeader>
      <CardContent>
        {grants.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No grants yet. Click &quot;New Grant&quot; to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {grants.map((grant) => {
              const statusConfig = getStatusConfig(grant.status);
              const nextDeadline = getNextDeadline(grant);
              return (
                <button
                  key={grant.id}
                  onClick={() => onClickGrant(grant.id)}
                  className="flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{grant.name}</span>
                      <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      {grant.funder?.name && <span>{grant.funder.name}</span>}
                      {nextDeadline && (
                        <>
                          <span>·</span>
                          <span className={isOverdue(nextDeadline.date) ? 'text-red-600 dark:text-red-400' : ''}>
                            {nextDeadline.type}: {formatDate(nextDeadline.date)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-medium">{formatCurrency(grant.amount_requested)}</div>
                    {grant.amount_awarded != null && (
                      <div className="text-sm text-green-600 dark:text-green-400">
                        Awarded: {formatCurrency(grant.amount_awarded)}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
