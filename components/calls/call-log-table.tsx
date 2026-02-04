'use client';

import { useCalls } from '@/hooks/use-calls';
import { useParams } from 'next/navigation';
import { DISPOSITION_LABELS, CALL_STATUS_LABELS } from '@/types/call';
import type { CallDisposition, CallStatus } from '@/types/call';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  PhoneIncoming,
  PhoneOutgoing,
  Play,
  Loader2,
} from 'lucide-react';
import { CallRecordingPlayer } from './call-recording-player';
import { useState } from 'react';

interface CallLogTableProps {
  personId?: string;
  organizationId?: string;
  opportunityId?: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDispositionColor(disposition: string): string {
  switch (disposition) {
    case 'quality_conversation':
    case 'meeting_booked':
      return 'bg-green-100 text-green-700';
    case 'not_interested':
    case 'do_not_call':
    case 'wrong_number':
      return 'bg-red-100 text-red-700';
    case 'left_voicemail':
    case 'call_back_later':
      return 'bg-yellow-100 text-yellow-700';
    case 'no_answer':
    case 'busy':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'hangup':
      return 'bg-green-100 text-green-700';
    case 'no_answer':
    case 'busy':
    case 'failed':
      return 'bg-red-100 text-red-700';
    case 'machine_detected':
      return 'bg-yellow-100 text-yellow-700';
    default:
      return 'bg-blue-100 text-blue-700';
  }
}

export function CallLogTable({
  personId,
  organizationId,
  opportunityId,
}: CallLogTableProps) {
  const params = useParams();
  const slug = params?.slug as string;
  const [playingId, setPlayingId] = useState<string | null>(null);

  const { calls, isLoading, hasMore, loadMore } = useCalls({
    projectSlug: slug,
    personId,
    organizationId,
    opportunityId,
  });

  if (isLoading && calls.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No calls recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Contact</th>
              <th className="px-3 py-2 text-left font-medium">Dir</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Duration</th>
              <th className="px-3 py-2 text-left font-medium">Disposition</th>
              <th className="px-3 py-2 text-left font-medium">Rec</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <tr key={call.id} className="border-b last:border-0 hover:bg-muted/25">
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {formatDate(call.started_at)}
                </td>
                <td className="px-3 py-2">
                  {call.person ? (
                    <span className="font-medium">
                      {call.person.first_name} {call.person.last_name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {call.direction === 'outbound' ? call.to_number : call.from_number}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {call.direction === 'outbound' ? (
                    <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                  ) : (
                    <PhoneIncoming className="h-4 w-4 text-green-500" />
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="secondary" className={`text-xs ${getStatusColor(call.status)}`}>
                    {CALL_STATUS_LABELS[call.status as CallStatus] ?? call.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 font-mono text-muted-foreground">
                  {formatDuration(call.talk_time_seconds)}
                </td>
                <td className="px-3 py-2">
                  {call.disposition ? (
                    <Badge
                      variant="secondary"
                      className={`text-xs ${getDispositionColor(call.disposition)}`}
                    >
                      {DISPOSITION_LABELS[call.disposition as CallDisposition] ?? call.disposition}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {call.recording_url ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() =>
                        setPlayingId(playingId === call.id ? null : call.id)
                      }
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inline recording player */}
      {playingId && (
        <div className="border rounded-md p-3">
          {(() => {
            const call = calls.find((c) => c.id === playingId);
            return call?.recording_url ? (
              <CallRecordingPlayer
                url={call.recording_url}
                onClose={() => setPlayingId(null)}
              />
            ) : null;
          })()}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
