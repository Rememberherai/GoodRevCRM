'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, CheckCircle, Activity } from 'lucide-react';
import type { TeamPerformance } from '@/types/report';

interface TeamLeaderboardProps {
  data: TeamPerformance[];
  title?: string;
}

export function TeamLeaderboard({ data, title = 'Team Leaderboard' }: TeamLeaderboardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}.`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No team performance data available
          </p>
        ) : (
          <div className="space-y-4">
            {data.slice(0, 10).map((member, index) => (
              <div
                key={member.user_id}
                className={`p-3 rounded-lg ${index < 3 ? 'bg-muted/50' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getRankBadge(index)}</span>
                    <span className="font-medium truncate max-w-[200px]">
                      {member.user_email}
                    </span>
                  </div>
                  <span className="font-bold text-green-600">
                    {formatCurrency(member.total_won_value)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    <span>{member.opportunities_created} created</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-600">
                    <Trophy className="h-3 w-3" />
                    <span>{member.opportunities_won} won</span>
                  </div>
                  <div className="flex items-center gap-1 text-blue-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>{member.tasks_completed} tasks</span>
                  </div>
                  <div className="flex items-center gap-1 text-purple-600">
                    <Activity className="h-3 w-3" />
                    <span>{member.activities_logged} activities</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
