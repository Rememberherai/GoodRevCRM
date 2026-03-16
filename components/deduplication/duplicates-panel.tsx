'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Search, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { DuplicateReviewModal } from './duplicate-review-modal';
import type { DuplicateCandidateWithRecords, DeduplicationEntityType, MatchReason } from '@/types/deduplication';

interface DuplicatesPanelProps {
  slug: string;
}

export function DuplicatesPanel({ slug }: DuplicatesPanelProps) {
  const [candidates, setCandidates] = useState<DuplicateCandidateWithRecords[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [reviewCandidate, setReviewCandidate] = useState<DuplicateCandidateWithRecords | null>(null);

  // Settings
  const [minThreshold, setMinThreshold] = useState(0.60);
  const [autoMergeThreshold, setAutoMergeThreshold] = useState(0.95);
  const [showSettings, setShowSettings] = useState(false);

  const fetchCandidates = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: 'pending',
        page: page.toString(),
        limit: '20',
      });
      if (entityFilter !== 'all') {
        params.set('entity_type', entityFilter);
      }
      const res = await fetch(`/api/projects/${slug}/duplicates?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCandidates(data.candidates ?? []);
      setPagination(data.pagination ?? { page: 1, total: 0, totalPages: 0 });
    } catch {
      toast.error('Failed to load duplicates');
    } finally {
      setLoading(false);
    }
  }, [slug, entityFilter]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/dedup-settings`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.settings) {
        setMinThreshold(Number(data.settings.min_match_threshold));
        setAutoMergeThreshold(Number(data.settings.auto_merge_threshold));
      }
    } catch {
      // Use defaults
    }
  }, [slug]);

  useEffect(() => {
    fetchCandidates();
    fetchSettings();
  }, [fetchCandidates, fetchSettings]);

  const handleScan = async (entityType: DeduplicationEntityType) => {
    setScanning(true);
    try {
      const res = await fetch(`/api/projects/${slug}/duplicates/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: entityType, max_results: 100 }),
      });
      if (!res.ok) throw new Error('Scan failed');
      const data = await res.json();
      toast.success(`Scan complete: ${data.candidates_created} duplicates found across ${data.records_scanned} records`);
      fetchCandidates();
    } catch {
      toast.error('Failed to scan for duplicates');
    } finally {
      setScanning(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/projects/${slug}/dedup-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_match_threshold: minThreshold,
          auto_merge_threshold: autoMergeThreshold,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAllowAll = async () => {
    const pendingIds = candidates.map(c => c.id);
    if (pendingIds.length === 0) return;

    for (const id of pendingIds) {
      await fetch(`/api/projects/${slug}/duplicates/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'allow' }),
      });
    }
    toast.success(`${pendingIds.length} candidates dismissed`);
    fetchCandidates();
  };

  const getDisplayName = (record: Record<string, unknown> | null, entityType: string): string => {
    if (!record) return 'Deleted record';
    if (entityType === 'person') {
      return [record.first_name, record.last_name].filter(Boolean).join(' ') || 'Unknown';
    }
    return (record.name as string) || 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Duplicate Detection</CardTitle>
              <CardDescription>
                Find and merge duplicate records in your project
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleScan('person')}
                disabled={scanning}
              >
                {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Scan People
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleScan('organization')}
                disabled={scanning}
              >
                {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Scan Orgs
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Settings Panel (collapsible) */}
        {showSettings && (
          <CardContent className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Minimum Match Threshold: {Math.round(minThreshold * 100)}%
                </Label>
                <Slider
                  value={[minThreshold * 100]}
                  onValueChange={([v]) => v !== undefined && setMinThreshold(v / 100)}
                  min={30}
                  max={95}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  Records below this score won&apos;t be flagged as potential duplicates.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Auto-merge Threshold: {Math.round(autoMergeThreshold * 100)}%
                </Label>
                <Slider
                  value={[autoMergeThreshold * 100]}
                  onValueChange={([v]) => v !== undefined && setAutoMergeThreshold(v / 100)}
                  min={80}
                  max={100}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  During imports, records above this score will be auto-merged.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Filter and list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">
                Pending Duplicates ({pagination.total})
              </CardTitle>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="person">People</SelectItem>
                  <SelectItem value="organization">Organizations</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => fetchCandidates()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              {candidates.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleAllowAll}>
                  Dismiss All
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending duplicates. Run a scan to check for duplicates.
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setReviewCandidate(candidate)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {candidate.entity_type}
                      </Badge>
                      <span className="text-sm font-medium truncate">
                        {getDisplayName(candidate.source_record, candidate.entity_type)}
                      </span>
                      <span className="text-xs text-muted-foreground">vs</span>
                      <span className="text-sm font-medium truncate">
                        {getDisplayName(candidate.target_record, candidate.entity_type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {(candidate.match_reasons as MatchReason[]).map((r, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {r.field}
                        </Badge>
                      ))}
                      <span className="text-xs text-muted-foreground">
                        via {candidate.detection_source.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-20">
                      <Progress value={Number(candidate.match_score) * 100} className="h-1.5" />
                    </div>
                    <Badge variant={Number(candidate.match_score) >= 0.85 ? 'destructive' : 'secondary'}>
                      {Math.round(Number(candidate.match_score) * 100)}%
                    </Badge>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchCandidates(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchCandidates(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Modal */}
      {reviewCandidate && (
        <DuplicateReviewModal
          open={true}
          onClose={() => setReviewCandidate(null)}
          entityType={reviewCandidate.entity_type as DeduplicationEntityType}
          sourceRecord={reviewCandidate.source_record as Record<string, unknown>}
          targetRecord={reviewCandidate.target_record as Record<string, unknown>}
          matchScore={Number(reviewCandidate.match_score)}
          matchReasons={reviewCandidate.match_reasons as MatchReason[]}
          candidateId={reviewCandidate.id}
          projectSlug={slug}
          onResolved={() => {
            setReviewCandidate(null);
            fetchCandidates();
          }}
        />
      )}
    </div>
  );
}
