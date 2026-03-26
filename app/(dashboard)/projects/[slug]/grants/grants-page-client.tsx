'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Award, Plus, List, LayoutGrid, Upload, Search, ArrowRight, Star, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NewGrantDialog } from '@/components/community/grants/new-grant-dialog';
import { GrantImportDialog } from '@/components/grants/grant-import-dialog';
import { toast } from 'sonner';

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
  category: string | null;
  mission_fit: number | null;
  tier: number | null;
  urgency: string | null;
  is_discovered: boolean;
  source_url: string | null;
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
  { value: 'active', label: 'Active', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  { value: 'declined', label: 'Declined', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
] as const;

function formatCurrency(amount: number | null) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function parseLocalDate(dateStr: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr + 'T00:00:00');
  return new Date(dateStr);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  ].filter((d) => d.date && parseLocalDate(d.date) >= now);
  deadlines.sort((a, b) => parseLocalDate(a.date!).getTime() - parseLocalDate(b.date!).getTime());
  return deadlines[0] ?? null;
}

function isOverdue(dateStr: string | null) {
  if (!dateStr) return false;
  const deadline = parseLocalDate(dateStr);
  deadline.setHours(23, 59, 59, 999);
  return deadline < new Date();
}

function applyFilters(
  grants: GrantRecord[],
  search: string,
  tier: string,
  category: string,
  urgency: string,
  status: string,
) {
  let result = grants;
  if (search.trim()) {
    const q = search.toLowerCase();
    result = result.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.funder?.name?.toLowerCase().includes(q) ||
        g.notes?.toLowerCase().includes(q),
    );
  }
  if (tier) result = result.filter((g) => g.tier === Number(tier));
  if (category) result = result.filter((g) => g.category === category);
  if (urgency) result = result.filter((g) => g.urgency === urgency);
  if (status) result = result.filter((g) => g.status === status);
  return result;
}

export default function GrantsPageClient() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'discovered' ? 'discovered' : 'pipeline';
  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [discoveredGrants, setDiscoveredGrants] = useState<GrantRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activeTab, setActiveTab] = useState<'pipeline' | 'discovered'>(initialTab);

  // Filters
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterUrgency, setFilterUrgency] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const hasActiveFilters = !!(search || filterTier || filterCategory || filterUrgency || filterStatus);

  const clearFilters = () => {
    setSearch('');
    setFilterTier('');
    setFilterCategory('');
    setFilterUrgency('');
    setFilterStatus('');
  };

  const filteredGrants = useMemo(
    () => applyFilters(grants, search, filterTier, filterCategory, filterUrgency, filterStatus),
    [grants, search, filterTier, filterCategory, filterUrgency, filterStatus],
  );

  const fetchGrants = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const [pipelineRes, discoveredRes] = await Promise.all([
        fetch(`/api/projects/${slug}/grants?limit=500&discovered=false`),
        fetch(`/api/projects/${slug}/grants?limit=500&discovered=true`),
      ]);
      if (!pipelineRes.ok) throw new Error('Failed to fetch grants');
      if (!discoveredRes.ok) throw new Error('Failed to fetch discovered grants');
      const pipelineJson = await pipelineRes.json() as { grants?: GrantRecord[]; error?: string };
      const discoveredJson = await discoveredRes.json() as { grants?: GrantRecord[]; error?: string };
      setGrants(pipelineJson.grants ?? []);
      setDiscoveredGrants(discoveredJson.grants ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch grants');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchGrants(); }, [fetchGrants]);

  const promoteGrant = async (grantId: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/grants/${grantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_discovered: false, status: 'researching' }),
      });
      if (!res.ok) throw new Error('Failed to promote grant');
      toast.success('Grant added to pipeline');
      await fetchGrants(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to promote');
    }
  };

  const dismissGrant = async (grantId: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/grants/${grantId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to dismiss grant');
      toast.success('Grant dismissed');
      await fetchGrants(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to dismiss');
    }
  };

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
      await fetchGrants(false);
    } catch (err) {
      console.error('Failed to update grant status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update status');
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
          {activeTab === 'pipeline' && (
            <>
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
            </>
          )}
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Grant
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'pipeline'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('pipeline')}
        >
          Pipeline ({grants.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'discovered'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('discovered')}
        >
          <Search className="inline mr-1 h-3.5 w-3.5" />
          Discovered
          {discoveredGrants.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-xs">{discoveredGrants.length}</Badge>
          )}
        </button>
      </div>

      {/* Filter Bar — pipeline tab only */}
      {activeTab === 'pipeline' && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search grants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>

          <Select value={filterTier || '__all__'} onValueChange={(v) => setFilterTier(v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-9 w-[110px]">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Tiers</SelectItem>
              <SelectItem value="1">Tier 1</SelectItem>
              <SelectItem value="2">Tier 2</SelectItem>
              <SelectItem value="3">Tier 3</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterCategory || '__all__'} onValueChange={(v) => setFilterCategory(v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              <SelectItem value="federal">Federal</SelectItem>
              <SelectItem value="state">State</SelectItem>
              <SelectItem value="corporate">Corporate</SelectItem>
              <SelectItem value="foundation">Foundation</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterUrgency || '__all__'} onValueChange={(v) => setFilterUrgency(v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue placeholder="Urgency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Urgency</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus || '__all__'} onValueChange={(v) => setFilterStatus(v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Statuses</SelectItem>
              {GRANT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}

          {hasActiveFilters && (
            <span className="text-sm text-muted-foreground">
              {filteredGrants.length} of {grants.length}
            </span>
          )}
        </div>
      )}

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

      {/* Pipeline Tab */}
      {!isLoading && activeTab === 'pipeline' && (
        viewMode === 'kanban' ? (
          <KanbanView
            grants={filteredGrants}
            onStatusChange={handleStatusChange}
            onClickGrant={(id) => router.push(`/projects/${slug}/grants/${id}`)}
          />
        ) : (
          <ListView
            grants={filteredGrants}
            onClickGrant={(id) => router.push(`/projects/${slug}/grants/${id}`)}
          />
        )
      )}

      {/* Discovered Tab */}
      {!isLoading && activeTab === 'discovered' && (
        <div className="space-y-3">
          {discoveredGrants.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No discovered grants. Use the Discover page to find and save grant opportunities.
              </CardContent>
            </Card>
          ) : (
            discoveredGrants.map((grant) => (
              <Card key={grant.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium">{grant.name}</h4>
                      {grant.funder?.name && (
                        <p className="text-sm text-muted-foreground">{grant.funder.name}</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        {grant.amount_requested != null && (
                          <Badge variant="secondary">{formatCurrency(grant.amount_requested)}</Badge>
                        )}
                        {grant.application_due_at && (
                          <Badge variant="outline">Due: {formatDate(grant.application_due_at)}</Badge>
                        )}
                      </div>
                      {grant.source_url && (
                        <a
                          href={grant.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline mt-1 inline-block"
                        >
                          View Source
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" onClick={() => promoteGrant(grant.id)}>
                        <ArrowRight className="mr-1 h-4 w-4" />
                        Add to Pipeline
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => dismissGrant(grant.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <NewGrantDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreated={fetchGrants}
      />
      <GrantImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImported={fetchGrants}
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
  const pipelineEnd = GRANT_STATUSES.findIndex((s) => s.value === 'closed');
  const nextStatus = currentIdx >= 0 && currentIdx < pipelineEnd - 1 ? GRANT_STATUSES[currentIdx + 1] : null;

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h4 className="font-medium leading-tight">{grant.name}</h4>
            {grant.mission_fit && (
              <span className="flex items-center shrink-0">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-3 w-3 ${n <= grant.mission_fit! ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`} />
                ))}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {grant.funder?.name && (
              <span className="text-sm text-muted-foreground">{grant.funder.name}</span>
            )}
            {grant.category && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{grant.category}</Badge>
            )}
            {grant.tier && (
              <Badge className={`text-[10px] px-1.5 py-0 ${grant.tier === 1 ? 'bg-green-100 text-green-700' : grant.tier === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-700'}`}>
                T{grant.tier}
              </Badge>
            )}
            {grant.urgency && grant.urgency !== 'low' && (
              <Badge className={`text-[10px] px-1.5 py-0 ${grant.urgency === 'critical' ? 'bg-red-100 text-red-700' : grant.urgency === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {grant.urgency}
              </Badge>
            )}
          </div>
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
            No grants match your filters.
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{grant.name}</span>
                      <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                      {grant.category && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{grant.category}</Badge>
                      )}
                      {grant.tier && (
                        <Badge className={`text-[10px] px-1.5 py-0 ${grant.tier === 1 ? 'bg-green-100 text-green-700' : grant.tier === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-700'}`}>
                          T{grant.tier}
                        </Badge>
                      )}
                      {grant.urgency && grant.urgency !== 'low' && (
                        <Badge className={`text-[10px] px-1.5 py-0 ${grant.urgency === 'critical' ? 'bg-red-100 text-red-700' : grant.urgency === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {grant.urgency}
                        </Badge>
                      )}
                      {grant.mission_fit && (
                        <span className="flex items-center shrink-0">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} className={`h-3 w-3 ${n <= grant.mission_fit! ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`} />
                          ))}
                        </span>
                      )}
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
