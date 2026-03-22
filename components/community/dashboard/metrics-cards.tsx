import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CommunityDashboardMetrics } from '@/lib/community/dashboard';

interface MetricsCardsProps {
  metrics: CommunityDashboardMetrics;
}

const metricConfig = [
  { key: 'totalHouseholds', title: 'Households', description: 'Total registered households' },
  { key: 'activePrograms', title: 'Active Programs', description: 'Programs currently running' },
  { key: 'volunteerHours', title: 'Work Hours', description: 'Hours logged this period' },
  { key: 'contributionsValue', title: 'Contributions', description: 'Total recorded value' },
  { key: 'attendanceCount', title: 'Attendance', description: 'Program attendance records' },
  { key: 'uniqueVisitors', title: 'Unique Visitors', description: 'Distinct people served' },
] as const;

export function MetricsCards({ metrics }: MetricsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {metricConfig.map((metric) => {
        const value = metrics[metric.key];
        const formatted = metric.key === 'contributionsValue'
          ? `$${Number(value).toLocaleString()}`
          : Number(value).toLocaleString();

        return (
          <Card key={metric.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <CardDescription>{metric.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatted}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
