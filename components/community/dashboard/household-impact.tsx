import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface HouseholdImpactProps {
  registeredHouseholds: number;
  denominator: number | null;
  percentage: number | null;
}

export function HouseholdImpact({ registeredHouseholds, denominator, percentage }: HouseholdImpactProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Household Impact</CardTitle>
        <CardDescription>Registered households as a percentage of the service area.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-3xl font-semibold">
          {percentage === null ? '—' : `${percentage.toFixed(1)}%`}
        </div>
        <div className="text-sm text-muted-foreground">
          {denominator === null
            ? 'Configure service area in project settings to calculate this metric.'
            : `${registeredHouseholds.toLocaleString()} of ${denominator.toLocaleString()} households impacted`}
        </div>
      </CardContent>
    </Card>
  );
}
