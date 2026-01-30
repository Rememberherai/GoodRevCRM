'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RevenueMetrics } from '@/types/report';

interface RevenueChartProps {
  data: RevenueMetrics[];
  title?: string;
}

export function RevenueChart({ data, title = 'Revenue Metrics' }: RevenueChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Take last 6 months
  const recentData = useMemo(() => data.slice(0, 6).reverse(), [data]);

  const maxValue = useMemo(() => {
    return Math.max(...recentData.map((d) => d.closed_won_value), 1);
  }, [recentData]);

  const totals = useMemo(() => {
    return {
      closedWon: recentData.reduce((sum, d) => sum + d.closed_won_value, 0),
      expected: recentData.reduce((sum, d) => sum + d.expected_value, 0),
      deals: recentData.reduce((sum, d) => sum + d.opportunity_count, 0),
    };
  }, [recentData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {recentData.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No revenue data available</p>
        ) : (
          <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totals.closedWon)}
                </p>
                <p className="text-xs text-muted-foreground">Closed Won</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totals.expected)}
                </p>
                <p className="text-xs text-muted-foreground">Expected Value</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{totals.deals}</p>
                <p className="text-xs text-muted-foreground">Total Deals</p>
              </div>
            </div>

            {/* Bar chart */}
            <div className="space-y-3">
              {recentData.map((row) => (
                <div key={row.month} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{formatDate(row.month)}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(row.closed_won_value)}
                    </span>
                  </div>
                  <div className="h-6 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{
                        width: `${(row.closed_won_value / maxValue) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{row.opportunity_count} deals</span>
                    <span>Avg: {formatCurrency(row.avg_deal_size)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
