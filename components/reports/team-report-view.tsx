'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Trophy, Target, CheckCircle } from 'lucide-react';
import { TeamLeaderboard } from '@/components/reports/team-leaderboard';
import type { AnalyticsData, DateRange } from '@/types/analytics';
import type { TeamPerformance } from '@/types/report';

interface TeamReportViewProps {
  data: AnalyticsData;
  projectSlug: string;
  dateRange: DateRange | undefined;
  userId: string | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function TeamReportView({ data, projectSlug, dateRange, userId }: TeamReportViewProps) {
  const [teamData, setTeamData] = React.useState<TeamPerformance[]>([]);
  const [, setLoading] = React.useState(true);

  // Fetch team performance data
  React.useEffect(() => {
    let cancelled = false;

    async function fetchTeamData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (dateRange) {
          params.set('start_date', dateRange.from.toISOString());
          params.set('end_date', dateRange.to.toISOString());
        }
        if (userId) {
          params.set('user_id', userId);
        }

        const res = await fetch(
          `/api/projects/${projectSlug}/analytics?${params.toString()}`
        );

        if (res.ok) {
          const json = await res.json();
          // The analytics endpoint doesn't return team performance directly,
          // but we can derive it from the team members and available data
          // For now use team leaderboard data if available
          if (!cancelled && json.teamPerformance) {
            setTeamData(json.teamPerformance);
          }
        }
      } catch {
        // Silently handle
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTeamData();
    return () => { cancelled = true; };
  }, [projectSlug, dateRange, userId]);

  // Team summary stats
  const totalMembers = data.teamMembers.length;

  return (
    <div className="space-y-6">
      {/* Team Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Team Members</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {totalMembers}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Activities</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {data.activityTiles.calls +
                    data.activityTiles.emails_sent +
                    data.activityTiles.meetings_booked}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Deals Won</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {data.conversion.reduce((sum, c) => sum + Number(c.won_count), 0)}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <Trophy className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Revenue Won</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(data.conversion.reduce((sum, c) => sum + Number(c.won_value), 0))}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Leaderboard */}
      <TeamLeaderboard data={teamData} title="Team Performance Leaderboard" />

      {/* Team Members Grid */}
      {data.teamMembers.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Team Members</h3>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            {data.teamMembers.map((member) => (
              <Card key={member.userId} className="hover:shadow-md transition-all duration-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      {member.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{member.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
