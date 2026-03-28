'use client';

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

export function PublicRadarChart({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; totalValue: number; color?: string | null }>;
}) {
  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Balanced investment across all dimensions of community wellbeing.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={items.map((item) => ({ label: item.label, value: item.totalValue }))}>
              <PolarGrid className="stroke-border/60" />
              <PolarAngleAxis dataKey="label" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar
                dataKey="value"
                stroke="var(--chart-2, #0f766e)"
                fill="var(--chart-2, #0f766e)"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 justify-center">
            {items.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5 text-sm">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color || 'var(--chart-2, #0f766e)' }}
                />
                <span className="text-muted-foreground">{item.label}:</span>
                <span className="font-medium">{formatCurrency(item.totalValue)}</span>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
