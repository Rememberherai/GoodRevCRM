'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PipelineSummary } from '@/types/report';

interface PipelineChartProps {
  data: PipelineSummary[];
  title?: string;
}

export function PipelineChart({ data, title = 'Pipeline Overview' }: PipelineChartProps) {
  const maxValue = useMemo(() => {
    return Math.max(...data.map((d) => d.total_value), 1);
  }, [data]);

  const totalValue = useMemo(() => {
    return data.reduce((sum, d) => sum + d.total_value, 0);
  }, [data]);

  const totalOpportunities = useMemo(() => {
    return data.reduce((sum, d) => sum + d.opportunity_count, 0);
  }, [data]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {totalOpportunities} opportunities • {formatCurrency(totalValue)} total
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No pipeline data available</p>
        ) : (
          <div className="space-y-4">
            {data.map((stage) => (
              <div key={stage.stage_id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{stage.stage_name}</span>
                  <span className="text-muted-foreground">
                    {stage.opportunity_count} • {formatCurrency(stage.total_value)}
                  </span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{
                      width: `${(stage.total_value / maxValue) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Avg: {formatCurrency(stage.avg_value)}</span>
                  <span>Weighted: {formatCurrency(stage.weighted_value)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
