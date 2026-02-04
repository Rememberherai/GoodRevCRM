'use client';

import { useParams } from 'next/navigation';
import { useCallMetrics } from '@/hooks/use-calls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Phone,
  PhoneOutgoing,
  Timer,
  Target,
  Loader2,
} from 'lucide-react';

interface CallMetricsCardsProps {
  startDate: string;
  endDate: string;
  userId?: string;
}

function formatTalkTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function CallMetricsCards({ startDate, endDate, userId }: CallMetricsCardsProps) {
  const params = useParams();
  const slug = params?.slug as string;

  const { metrics, isLoading } = useCallMetrics({
    projectSlug: slug,
    startDate,
    endDate,
    userId,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const cards = [
    {
      title: 'Total Calls',
      value: metrics.total_calls,
      subtitle: `${metrics.outbound_calls} outbound / ${metrics.inbound_calls} inbound`,
      icon: Phone,
    },
    {
      title: 'Connect Rate',
      value: `${metrics.connect_rate}%`,
      subtitle: `${metrics.answered_calls} answered / ${metrics.missed_calls} missed`,
      icon: PhoneOutgoing,
    },
    {
      title: 'Talk Time',
      value: formatTalkTime(metrics.total_talk_time_seconds),
      subtitle: `Avg ${formatTalkTime(Math.round(metrics.avg_talk_time_seconds))} per call`,
      icon: Timer,
    },
    {
      title: 'Meetings Booked',
      value: metrics.meetings_booked,
      subtitle: `${metrics.quality_conversations} quality conversations`,
      icon: Target,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
