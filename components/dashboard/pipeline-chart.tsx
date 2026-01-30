'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PipelineStage {
  count: number;
  value: number;
}

interface PipelineChartProps {
  pipeline: Record<string, PipelineStage>;
}

const stageConfig: Record<string, { label: string; color: string }> = {
  lead: { label: 'Lead', color: 'bg-slate-500' },
  qualified: { label: 'Qualified', color: 'bg-blue-500' },
  proposal: { label: 'Proposal', color: 'bg-purple-500' },
  negotiation: { label: 'Negotiation', color: 'bg-orange-500' },
  won: { label: 'Won', color: 'bg-green-500' },
  lost: { label: 'Lost', color: 'bg-red-500' },
};

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function PipelineChart({ pipeline }: PipelineChartProps) {
  const stages = Object.entries(pipeline).filter(
    ([stage]) => stage !== 'unknown'
  );

  const totalValue = stages.reduce((sum, [, data]) => sum + data.value, 0);

  if (stages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Overview</CardTitle>
          <CardDescription>Opportunity distribution by stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No opportunities in pipeline
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline Overview</CardTitle>
        <CardDescription>Opportunity distribution by stage</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Bar chart */}
          <div className="flex h-4 w-full overflow-hidden rounded-full">
            {stages.map(([stage, data]) => {
              const config = stageConfig[stage] ?? { label: stage, color: 'bg-gray-500' };
              const percentage = totalValue > 0 ? (data.value / totalValue) * 100 : 0;

              if (percentage === 0) return null;

              return (
                <div
                  key={stage}
                  className={cn('transition-all', config.color)}
                  style={{ width: `${percentage}%` }}
                  title={`${config.label}: ${formatCurrency(data.value)}`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {stages.map(([stage, data]) => {
              const config = stageConfig[stage] ?? { label: stage, color: 'bg-gray-500' };

              return (
                <div key={stage} className="flex items-center gap-2">
                  <div className={cn('h-3 w-3 rounded-full', config.color)} />
                  <div>
                    <p className="text-sm font-medium">{config.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {data.count} ({formatCurrency(data.value)})
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="pt-4 border-t">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Pipeline</span>
              <span className="font-semibold">{formatCurrency(totalValue)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
