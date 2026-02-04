'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Target, DollarSign, BarChart3, Hash } from 'lucide-react';
import { OpportunityFunnelChart } from '@/components/dashboard/opportunity-funnel-chart';
import { PipelineChart } from '@/components/reports/pipeline-chart';
import type { AnalyticsData } from '@/types/analytics';
import type { PipelineSummary } from '@/types/report';

interface PipelineReportViewProps {
  data: AnalyticsData;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function PipelineReportView({ data }: PipelineReportViewProps) {
  const stats = useMemo(() => {
    const totalValue = data.pipeline.reduce((sum, s) => sum + Number(s.total_value), 0);
    const weightedValue = data.pipeline.reduce((sum, s) => sum + Number(s.weighted_value), 0);
    const totalOpps = data.pipeline.reduce((sum, s) => sum + Number(s.opportunity_count), 0);
    const avgDeal = totalOpps > 0 ? totalValue / totalOpps : 0;
    return { totalValue, weightedValue, totalOpps, avgDeal };
  }, [data.pipeline]);

  // Map analytics PipelineStage to report PipelineSummary format
  const pipelineSummary: PipelineSummary[] = useMemo(() => {
    const stageOrder = ['prospecting', 'qualification', 'proposal', 'negotiation'];
    return data.pipeline
      .map((stage, index) => ({
        stage_id: stage.stage_name,
        stage_name: stage.stage_name
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
        stage_position: stageOrder.indexOf(stage.stage_name) >= 0
          ? stageOrder.indexOf(stage.stage_name)
          : index,
        opportunity_count: Number(stage.opportunity_count),
        total_value: Number(stage.total_value),
        avg_value: Number(stage.avg_value),
        weighted_value: Number(stage.weighted_value),
      }))
      .sort((a, b) => a.stage_position - b.stage_position);
  }, [data.pipeline]);

  const KPI_CARDS = [
    {
      label: 'Total Pipeline',
      value: formatCurrency(stats.totalValue),
      icon: Target,
      color: 'emerald',
    },
    {
      label: 'Weighted Value',
      value: formatCurrency(stats.weightedValue),
      icon: DollarSign,
      color: 'green',
    },
    {
      label: 'Avg Deal Size',
      value: formatCurrency(stats.avgDeal),
      icon: BarChart3,
      color: 'blue',
    },
    {
      label: 'Open Opportunities',
      value: stats.totalOpps.toLocaleString(),
      icon: Hash,
      color: 'purple',
    },
  ];

  const COLOR_CLASSES: Record<string, string> = {
    emerald: 'border-l-emerald-500 text-emerald-600 dark:text-emerald-400',
    green: 'border-l-green-500 text-green-600 dark:text-green-400',
    blue: 'border-l-blue-500 text-blue-600 dark:text-blue-400',
    purple: 'border-l-purple-500 text-purple-600 dark:text-purple-400',
  };

  const ICON_BG: Record<string, string> = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {KPI_CARDS.map((kpi) => (
          <Card key={kpi.label} className={`border-l-4 ${COLOR_CLASSES[kpi.color]}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${COLOR_CLASSES[kpi.color]}`}>
                    {kpi.value}
                  </p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${ICON_BG[kpi.color]}`}>
                  <kpi.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PipelineChart data={pipelineSummary} title="Pipeline by Stage" />
        <OpportunityFunnelChart data={data.opportunityFunnel} />
      </div>
    </div>
  );
}
