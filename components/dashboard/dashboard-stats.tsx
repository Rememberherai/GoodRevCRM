'use client';

import {
  Users,
  Building2,
  Target,
  FileText,
  CheckSquare,
  DollarSign,
  Mail,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardStatsFromRpc } from '@/types/dashboard';

interface DashboardStatsProps {
  stats: DashboardStatsFromRpc;
}

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const statCards = [
    {
      title: 'People',
      value: formatNumber(stats.total_people),
      icon: Users,
      color: 'text-blue-500',
    },
    {
      title: 'Organizations',
      value: formatNumber(stats.total_organizations),
      icon: Building2,
      color: 'text-green-500',
    },
    {
      title: 'Opportunities',
      value: formatNumber(stats.total_opportunities),
      icon: Target,
      color: 'text-purple-500',
    },
    {
      title: 'RFPs',
      value: formatNumber(stats.total_rfps),
      icon: FileText,
      color: 'text-orange-500',
    },
    {
      title: 'Pipeline Value',
      value: formatCurrency(stats.total_pipeline_value),
      icon: DollarSign,
      color: 'text-emerald-500',
    },
    {
      title: 'Won Value',
      value: formatCurrency(stats.won_value),
      icon: DollarSign,
      color: 'text-emerald-600',
    },
    {
      title: 'Open Tasks',
      value: formatNumber(stats.pending_tasks),
      subtitle: `of ${formatNumber(stats.total_tasks)} total`,
      icon: CheckSquare,
      color: 'text-amber-500',
    },
    {
      title: 'Emails Sent',
      value: formatNumber(stats.emails_sent),
      subtitle: `${formatNumber(stats.emails_opened)} opened`,
      icon: Mail,
      color: 'text-cyan-500',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.subtitle && (
                <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
