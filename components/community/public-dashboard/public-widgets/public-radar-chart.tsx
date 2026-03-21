'use client';

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PublicRadarChart({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; totalValue: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={items.map((item) => ({ label: item.label, value: item.totalValue }))}>
              <PolarGrid />
              <PolarAngleAxis dataKey="label" tick={{ fontSize: 12 }} />
              <Radar dataKey="value" stroke="#0f766e" fill="#0f766e" fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
