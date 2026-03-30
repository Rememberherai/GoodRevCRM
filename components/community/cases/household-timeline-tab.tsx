'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

type TimelineType = 'intake' | 'referral' | 'note' | 'task' | 'case_event' | 'incident';

interface TimelineItem {
  id: string;
  type: TimelineType;
  timestamp: string;
  summary: string;
  actor: { id: string; name: string } | null;
  metadata: Record<string, unknown>;
}

interface HouseholdTimelineTabProps {
  projectSlug: string;
  householdId: string;
}

const FILTERS: TimelineType[] = ['intake', 'referral', 'note', 'task', 'case_event', 'incident'];

export function HouseholdTimelineTab({ projectSlug, householdId }: HouseholdTimelineTabProps) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<TimelineType[]>(FILTERS);

  const filterParam = useMemo(() => selectedFilters.join(','), [selectedFilters]);

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/households/${householdId}/timeline?types=${encodeURIComponent(filterParam)}&limit=100`);
      const data = await response.json() as { items?: TimelineItem[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load timeline');
      }
      setItems(data.items ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [filterParam, householdId, projectSlug]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  async function handleAddNote() {
    if (!noteContent.trim()) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: noteContent.trim(),
          household_id: householdId,
          category: 'timeline',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to add note');
      }
      setNoteContent('');
      await loadTimeline();
      toast.success('Note added');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add note');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Timeline Note</CardTitle>
          <CardDescription>
            Quick household note that will appear in the unified timeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={4}
            value={noteContent}
            onChange={(event) => setNoteContent(event.target.value)}
            placeholder="Add a note to the household timeline"
          />
          <Button onClick={handleAddNote} disabled={submitting || !noteContent.trim()}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add Note
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>
            Intake, referrals, tasks, case milestones, and incidents in one feed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => {
              const active = selectedFilters.includes(filter);
              return (
                <Button
                  key={filter}
                  type="button"
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  onClick={() =>
                    setSelectedFilters((current) => (
                      active ? current.filter((item) => item !== filter) : [...current, filter]
                    ))
                  }
                >
                  {filter.replace('_', ' ')}
                </Button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading timeline
            </div>
          ) : items.length ? (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={`${item.type}-${item.id}`} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium capitalize">
                      {item.type.replace('_', ' ')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-2 text-sm">{item.summary}</div>
                  {item.actor ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {item.actor.name}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No timeline activity yet for the selected filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
