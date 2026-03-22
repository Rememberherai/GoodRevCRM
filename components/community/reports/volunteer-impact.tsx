import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface VolunteerImpactReport {
  total_volunteers: number;
  total_hours: number;
  estimated_value: number;
  by_program: { program_id: string; program_name: string; hours: number; volunteers: number }[];
}

export function VolunteerImpactReportView({ data }: { data?: VolunteerImpactReport }) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Work Hours Impact</CardTitle>
          <CardDescription>No work hours data yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Work Hours Totals</CardTitle>
          <CardDescription>Hours, estimated value, and participating workers.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Metric label="Workers" value={data.total_volunteers.toLocaleString()} />
          <Metric label="Hours" value={data.total_hours.toFixed(1)} />
          <Metric label="Estimated Value" value={`$${data.estimated_value.toFixed(2)}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By Program</CardTitle>
          <CardDescription>Work hours distribution across programs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.by_program.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No work hours program activity yet.
            </div>
          ) : data.by_program.map((row) => (
            <div key={row.program_id} className="rounded-lg border p-3">
              <div className="font-medium">{row.program_name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {row.hours.toFixed(1)} hours • {row.volunteers} workers
              </div>
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
