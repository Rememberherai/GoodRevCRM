import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PublicMapHeatmap({ title, granularity }: { title: string; granularity: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Aggregate geographic coverage is published at the {granularity} level. Exact household or asset points are never exposed on the public dashboard.
      </CardContent>
    </Card>
  );
}
