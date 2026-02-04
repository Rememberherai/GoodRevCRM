'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityTilesRow } from '@/components/dashboard/activity-tiles';
import { EmailStatsCard } from '@/components/dashboard/email-stats-card';
import type { AnalyticsData } from '@/types/analytics';

interface ActivityReportViewProps {
  data: AnalyticsData;
}

export function ActivityReportView({ data }: ActivityReportViewProps) {
  const totalActivities =
    data.activityTiles.calls +
    data.activityTiles.emails_sent +
    data.activityTiles.quality_conversations +
    data.activityTiles.meetings_booked +
    data.activityTiles.meetings_attended;

  return (
    <div className="space-y-6">
      {/* Activity Tiles */}
      <ActivityTilesRow data={data.activityTiles} />

      {/* Activity Summary + Email Performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ActivityBar
                label="Calls"
                count={data.activityTiles.calls}
                total={totalActivities}
                color="bg-blue-500"
                bgColor="bg-blue-500/20"
              />
              <ActivityBar
                label="Emails Sent"
                count={data.activityTiles.emails_sent}
                total={totalActivities}
                color="bg-green-500"
                bgColor="bg-green-500/20"
              />
              <ActivityBar
                label="Quality Conversations"
                count={data.activityTiles.quality_conversations}
                total={totalActivities}
                color="bg-purple-500"
                bgColor="bg-purple-500/20"
              />
              <ActivityBar
                label="Meetings Booked"
                count={data.activityTiles.meetings_booked}
                total={totalActivities}
                color="bg-orange-500"
                bgColor="bg-orange-500/20"
              />
              <ActivityBar
                label="Meetings Attended"
                count={data.activityTiles.meetings_attended}
                total={totalActivities}
                color="bg-emerald-500"
                bgColor="bg-emerald-500/20"
              />
            </div>
          </CardContent>
        </Card>

        {/* Email Performance */}
        <EmailStatsCard data={data.email} />
      </div>
    </div>
  );
}

function ActivityBar({
  label,
  count,
  total,
  color,
  bgColor,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  bgColor: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">{count}</span>
      </div>
      <div className={`h-2.5 rounded-full ${bgColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
