'use client';

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CommunityDashboardDimension } from '@/lib/community/dashboard';

interface ImpactRadarProps {
  dimensions: CommunityDashboardDimension[];
}

export function ImpactRadar({ dimensions }: ImpactRadarProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Impact Radar</CardTitle>
        <CardDescription>
          Active framework dimensions for this community project.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={dimensions}>
              <PolarGrid />
              <PolarAngleAxis dataKey="label" tick={{ fontSize: 12 }} />
              <Radar dataKey="value" stroke="#0f766e" fill="#0f766e" fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-2">
          {dimensions.map((dimension) => (
            <span
              key={dimension.id}
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: `${dimension.color}20`, color: dimension.color }}
            >
              {dimension.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
