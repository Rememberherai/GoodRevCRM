'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ConversionMetrics } from '@/types/report';

interface ConversionChartProps {
  data: ConversionMetrics[];
  title?: string;
}

export function ConversionChart({ data, title = 'Conversion Metrics' }: ConversionChartProps) {
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
  const recentData = data.slice(0, 6).reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {recentData.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No conversion data available
          </p>
        ) : (
          <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">
                  {recentData.reduce((sum, d) => sum + d.total_created, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Total Created</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {recentData.reduce((sum, d) => sum + d.won_count, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Won</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">
                  {recentData.reduce((sum, d) => sum + d.lost_count, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Lost</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {(() => {
                    const totalWon = recentData.reduce((sum, d) => sum + d.won_count, 0);
                    const totalClosed = recentData.reduce(
                      (sum, d) => sum + d.won_count + d.lost_count,
                      0
                    );
                    return totalClosed > 0
                      ? `${Math.round((totalWon / totalClosed) * 100)}%`
                      : 'N/A';
                  })()}
                </p>
                <p className="text-xs text-muted-foreground">Win Rate</p>
              </div>
            </div>

            {/* Monthly breakdown */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Month</th>
                    <th className="text-right py-2 font-medium">Created</th>
                    <th className="text-right py-2 font-medium">Won</th>
                    <th className="text-right py-2 font-medium">Lost</th>
                    <th className="text-right py-2 font-medium">Won Value</th>
                    <th className="text-right py-2 font-medium">Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {recentData.map((row) => (
                    <tr key={row.month} className="border-b last:border-0">
                      <td className="py-2">{formatDate(row.month)}</td>
                      <td className="text-right py-2">{row.total_created}</td>
                      <td className="text-right py-2 text-green-600">{row.won_count}</td>
                      <td className="text-right py-2 text-red-600">{row.lost_count}</td>
                      <td className="text-right py-2">{formatCurrency(row.won_value)}</td>
                      <td className="text-right py-2">
                        {row.win_rate !== null ? `${row.win_rate}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
