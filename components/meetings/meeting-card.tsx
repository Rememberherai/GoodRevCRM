'use client';

import { format, parseISO } from 'date-fns';
import { Clock, MapPin, Video, User, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MeetingStatusActions } from '@/components/meetings/meeting-status-actions';
import type { MeetingWithRelations } from '@/types/meeting';
import {
  MEETING_STATUS_COLORS,
  MEETING_STATUS_LABELS,
  MEETING_TYPE_LABELS,
} from '@/types/meeting';

interface MeetingCardProps {
  meeting: MeetingWithRelations;
  onStatusChange?: () => void;
  projectSlug: string;
}

export function MeetingCard({
  meeting,
  onStatusChange,
  projectSlug,
}: MeetingCardProps) {
  const scheduledDate = parseISO(meeting.scheduled_at);
  const formattedDate = format(scheduledDate, "MMM d, yyyy 'at' h:mm a");

  const showActions =
    meeting.status === 'scheduled' || meeting.status === 'confirmed';

  const personName = meeting.person
    ? `${meeting.person.first_name} ${meeting.person.last_name}`
    : null;

  const organizationName = meeting.organization?.name ?? null;

  return (
    <Card className="py-4">
      <CardContent className="space-y-3">
        {/* Top row: badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={MEETING_STATUS_COLORS[meeting.status]}>
            {MEETING_STATUS_LABELS[meeting.status]}
          </Badge>
          <Badge variant="outline">
            {MEETING_TYPE_LABELS[meeting.meeting_type]}
          </Badge>
        </div>

        {/* Title */}
        <h4 className="font-semibold text-sm leading-tight">{meeting.title}</h4>

        {/* Date and duration */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formattedDate}
          </span>
          <span>{meeting.duration_minutes} min</span>
        </div>

        {/* Location or meeting URL */}
        {meeting.location && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{meeting.location}</span>
          </div>
        )}
        {meeting.meeting_url && !meeting.location && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Video className="h-3.5 w-3.5 shrink-0" />
            <a
              href={meeting.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:underline text-primary"
            >
              Join Meeting
            </a>
          </div>
        )}

        {/* Person and organization */}
        {(personName || organizationName) && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {personName && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {personName}
              </span>
            )}
            {organizationName && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {organizationName}
              </span>
            )}
          </div>
        )}

        {/* Description preview */}
        {meeting.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {meeting.description}
          </p>
        )}

        {/* Actions for actionable statuses */}
        {showActions && (
          <div className="pt-1">
            <MeetingStatusActions
              meeting={meeting}
              projectSlug={projectSlug}
              onStatusChange={onStatusChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
