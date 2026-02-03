'use client';

import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useActivities } from '@/hooks/use-activities';
import { ActivityTimeline } from '@/components/activity/activity-timeline';
import { LogActivityModal } from '@/components/activity/log-activity-modal';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface EntityActivitySectionProps {
  projectSlug: string;
  entityType: 'person' | 'organization' | 'opportunity' | 'rfp';
  entityId: string;
  personId?: string;
  personName?: string;
  organizationId?: string;
  organizationName?: string;
  opportunityId?: string;
  rfpId?: string;
}

type ActivityFilter = 'all' | 'call' | 'email' | 'meeting' | 'note';

const FILTER_OPTIONS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'call', label: 'Calls' },
  { value: 'email', label: 'Emails' },
  { value: 'meeting', label: 'Meetings' },
  { value: 'note', label: 'Notes' },
];

export function EntityActivitySection({
  projectSlug,
  entityType,
  entityId,
  personId,
  personName,
  organizationId,
  organizationName,
  opportunityId,
  rfpId,
}: EntityActivitySectionProps) {
  const [showLogModal, setShowLogModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');

  const filterParams = useMemo(() => {
    const params: Record<string, string | undefined> = {};

    switch (entityType) {
      case 'person':
        params.personId = entityId;
        break;
      case 'organization':
        params.organizationId = entityId;
        break;
      case 'opportunity':
        params.opportunityId = entityId;
        break;
      case 'rfp':
        params.rfpId = entityId;
        break;
    }

    return params;
  }, [entityType, entityId]);

  const { activities, isLoading, hasMore, loadMore, refresh } = useActivities({
    projectSlug,
    ...filterParams,
    ...(activeFilter !== 'all' ? { activityType: activeFilter } : {}),
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Activity</CardTitle>
            <Button size="sm" onClick={() => setShowLogModal(true)}>
              <Plus className="h-4 w-4" />
              Log Activity
            </Button>
          </div>

          <div className="flex items-center gap-1 mt-2">
            {FILTER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={activeFilter === option.value ? 'secondary' : 'ghost'}
                size="xs"
                onClick={() => setActiveFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          <ActivityTimeline activities={activities} loading={isLoading} />

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" size="sm" onClick={loadMore}>
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <LogActivityModal
        open={showLogModal}
        onOpenChange={setShowLogModal}
        projectSlug={projectSlug}
        personId={personId ?? (entityType === 'person' ? entityId : undefined)}
        personName={personName}
        organizationId={
          organizationId ??
          (entityType === 'organization' ? entityId : undefined)
        }
        organizationName={organizationName}
        opportunityId={
          opportunityId ??
          (entityType === 'opportunity' ? entityId : undefined)
        }
        rfpId={rfpId ?? (entityType === 'rfp' ? entityId : undefined)}
        onSuccess={refresh}
      />
    </>
  );
}
