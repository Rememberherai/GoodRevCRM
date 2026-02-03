'use client';

import { useState, useMemo } from 'react';
import { Plus, Loader2, CalendarDays } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMeetings } from '@/hooks/use-meetings';
import { MeetingCard } from '@/components/meetings/meeting-card';
import { BookMeetingModal } from '@/components/meetings/book-meeting-modal';

interface EntityMeetingsSectionProps {
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

export function EntityMeetingsSection({
  projectSlug,
  entityType,
  entityId,
  personId,
  personName,
  organizationId,
  organizationName,
  opportunityId,
  rfpId,
}: EntityMeetingsSectionProps) {
  const [bookModalOpen, setBookModalOpen] = useState(false);

  // Build filter params based on entity type
  const filterParams = useMemo(() => {
    const params: {
      personId?: string;
      organizationId?: string;
      opportunityId?: string;
      rfpId?: string;
    } = {};

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

  const { meetings, isLoading, refresh, loadMore, hasMore } = useMeetings({
    projectSlug,
    ...filterParams,
  });

  // Split meetings into upcoming and past
  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const upcomingMeetings = meetings.filter((m) => {
      const scheduledAt = new Date(m.scheduled_at);
      return (
        scheduledAt > now &&
        (m.status === 'scheduled' || m.status === 'confirmed')
      );
    });
    const pastMeetings = meetings.filter((m) => {
      const scheduledAt = new Date(m.scheduled_at);
      return !(
        scheduledAt > now &&
        (m.status === 'scheduled' || m.status === 'confirmed')
      );
    });

    return { upcoming: upcomingMeetings, past: pastMeetings };
  }, [meetings]);

  // Build props for the BookMeetingModal based on entity context
  const modalProps = {
    personId: personId ?? (entityType === 'person' ? entityId : undefined),
    personName,
    organizationId:
      organizationId ?? (entityType === 'organization' ? entityId : undefined),
    organizationName,
    opportunityId:
      opportunityId ?? (entityType === 'opportunity' ? entityId : undefined),
    rfpId: rfpId ?? (entityType === 'rfp' ? entityId : undefined),
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" />
            Meetings
          </CardTitle>
          <CardAction>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBookModalOpen(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Book Meeting
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading meetings...
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No meetings yet
            </div>
          ) : (
            <div className="space-y-6">
              {/* Upcoming meetings */}
              {upcoming.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Upcoming
                  </h4>
                  <div className="space-y-3">
                    {upcoming.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        projectSlug={projectSlug}
                        onStatusChange={refresh}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Past meetings */}
              {past.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Past
                  </h4>
                  <div className="space-y-3">
                    {past.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        projectSlug={projectSlug}
                        onStatusChange={refresh}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button variant="ghost" size="sm" onClick={loadMore}>
                    Load more
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <BookMeetingModal
        open={bookModalOpen}
        onOpenChange={setBookModalOpen}
        projectSlug={projectSlug}
        {...modalProps}
        onSuccess={refresh}
      />
    </>
  );
}
