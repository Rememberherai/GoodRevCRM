'use client';

import { Users, FolderKanban, Activity, UserPlus, Bug, KeyRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdminStats } from '@/types/admin';

interface AdminStatsCardsProps {
  stats: AdminStats;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

function StatCard({ title, value, icon: Icon, description }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminStatsCards({ stats }: AdminStatsCardsProps) {
  return (
    <div className="space-y-4">
      {/* Primary stats row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={stats.total_users} icon={Users} />
        <StatCard title="Total Projects" value={stats.total_projects} icon={FolderKanban} />
        <StatCard
          title="Active Projects (7d)"
          value={stats.active_projects_7d}
          icon={Activity}
        />
        <StatCard
          title="New Users (30d)"
          value={stats.new_users_30d}
          icon={UserPlus}
        />
      </div>

      {/* Secondary stats row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Standard Projects"
          value={stats.projects_by_type.standard}
          icon={FolderKanban}
        />
        <StatCard
          title="Community Projects"
          value={stats.projects_by_type.community}
          icon={FolderKanban}
        />
        <StatCard
          title="Missing API Key"
          value={stats.projects_missing_api_key}
          icon={KeyRound}
          description="Projects without OpenRouter key"
        />
        <StatCard
          title="Open Bug Reports"
          value={stats.open_bug_reports}
          icon={Bug}
        />
      </div>
    </div>
  );
}
