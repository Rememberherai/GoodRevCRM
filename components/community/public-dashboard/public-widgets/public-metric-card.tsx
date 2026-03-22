import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PublicMetricCard({
  title,
  metrics,
}: {
  title: string;
  metrics: Array<{ label: string; value: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">{metric.label}</div>
            <div className="mt-2 text-2xl font-bold">{metric.value.toLocaleString()}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
