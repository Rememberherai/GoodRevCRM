import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PopulationImpactProps {
  servedPeople: number;
  denominator: number | null;
  percentage: number | null;
}

export function PopulationImpact({ servedPeople, denominator, percentage }: PopulationImpactProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Population Impact</CardTitle>
        <CardDescription>Unduplicated people served against the configured community denominator.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-3xl font-semibold">
          {percentage === null ? '—' : `${percentage.toFixed(1)}%`}
        </div>
        <div className="text-sm text-muted-foreground">
          {denominator === null
            ? 'Set `community_population_denominator` in project settings to calculate this metric.'
            : `${servedPeople.toLocaleString()} of ${denominator.toLocaleString()} people served`}
        </div>
      </CardContent>
    </Card>
  );
}
