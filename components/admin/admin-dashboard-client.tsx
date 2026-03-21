'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminStatsCards } from '@/components/admin/admin-stats-cards';
import { AdminStaleSessionsAlert } from '@/components/admin/admin-stale-sessions-alert';
import type { AdminStats } from '@/types/admin';

interface ActiveSession {
  id: string;
  project_id: string;
  project_name: string;
  project_slug: string;
  entered_at: string;
}

interface RecentAction {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: unknown;
  created_at: string;
  admin_name: string;
  admin_email: string;
}

interface AdminDashboardClientProps {
  stats: AdminStats;
  sessions: ActiveSession[];
  recentActions: RecentAction[];
}

const signupsChartConfig = {
  count: {
    label: 'Signups',
    color: 'var(--color-blue-500)',
  },
} satisfies ChartConfig;

const projectsChartConfig = {
  count: {
    label: 'Projects',
    color: 'var(--color-green-500)',
  },
} satisfies ChartConfig;

function formatWeek(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function AdminDashboardClient({
  stats,
  sessions,
  recentActions,
}: AdminDashboardClientProps) {
  const router = useRouter();
  const [exitingSession, setExitingSession] = useState<string | null>(null);

  const handleExitSession = async (sessionId: string) => {
    setExitingSession(sessionId);
    try {
      // For now, we'll implement this when the enter/exit API is built in Phase 4
      // This is a placeholder that will call POST /api/admin/sessions/[id]/exit
      setExitingSession(null);
      router.refresh();
    } catch {
      setExitingSession(null);
    }
  };

  const signupsData = stats.signups_by_week.map((d) => ({
    ...d,
    weekLabel: formatWeek(d.week),
  }));

  const projectsData = stats.projects_by_week.map((d) => ({
    ...d,
    weekLabel: formatWeek(d.week),
  }));

  return (
    <>
      <AdminHeader title="Dashboard" />
      <main className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stale session alert — renders first */}
        <AdminStaleSessionsAlert
          sessions={sessions}
          onExit={handleExitSession}
          isExiting={exitingSession}
        />

        {/* Stats cards */}
        <AdminStatsCards stats={stats} />

        {/* Charts row */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Signups by week */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">New Signups (12 weeks)</CardTitle>
            </CardHeader>
            <CardContent>
              {signupsData.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                  No signup data
                </div>
              ) : (
                <ChartContainer config={signupsChartConfig} className="aspect-auto h-[200px] w-full">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={signupsData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="weekLabel" tickLine={false} axisLine={false} className="text-xs" />
                      <YAxis tickLine={false} axisLine={false} className="text-xs" width={30} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-blue-500)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Projects by week */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">New Projects (12 weeks)</CardTitle>
            </CardHeader>
            <CardContent>
              {projectsData.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                  No project data
                </div>
              ) : (
                <ChartContainer config={projectsChartConfig} className="aspect-auto h-[200px] w-full">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={projectsData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="weekLabel" tickLine={false} axisLine={false} className="text-xs" />
                      <YAxis tickLine={false} axisLine={false} className="text-xs" width={30} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="var(--color-green-500)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent admin actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Admin Actions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No admin actions recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActions.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-sm">{action.admin_name}</TableCell>
                      <TableCell className="text-sm">
                        {action.action.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {action.target_type}
                        {action.target_id ? ` (${action.target_id.slice(0, 8)}...)` : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
