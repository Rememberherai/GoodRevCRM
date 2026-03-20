import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface HouseholdDemographicsReport {
  total_households: number;
  total_members: number;
  avg_household_size: number;
  by_city: { city: string; count: number }[];
}

export function HouseholdDemographicsReportView({ data }: { data?: HouseholdDemographicsReport }) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Household Demographics</CardTitle>
          <CardDescription>No household data yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Household Totals</CardTitle>
          <CardDescription>Current registered households and members.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Metric label="Households" value={data.total_households.toLocaleString()} />
          <Metric label="Members" value={data.total_members.toLocaleString()} />
          <Metric label="Avg Size" value={data.avg_household_size.toFixed(1)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By City</CardTitle>
          <CardDescription>Geographic spread across registered households.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.by_city.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No location data yet.
            </div>
          ) : data.by_city.map((row) => (
            <div key={row.city} className="flex items-center justify-between rounded-lg border p-3">
              <div className="font-medium">{row.city}</div>
              <div className="text-sm text-muted-foreground">{row.count}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
