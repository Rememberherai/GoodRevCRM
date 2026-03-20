import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ContractorHoursReport {
  total_contractors: number;
  total_hours: number;
  by_contractor: {
    contractor_id: string;
    contractor_name: string;
    hours: number;
    jobs: number;
    out_of_scope_jobs: number;
  }[];
}

export function ContractorHoursReportView({ data }: { data?: ContractorHoursReport }) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contractor Hours</CardTitle>
          <CardDescription>No contractor hour data yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Contractor Totals</CardTitle>
          <CardDescription>Tracked hours and active contractors with time entries.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Metric label="Contractors" value={data.total_contractors.toLocaleString()} />
          <Metric label="Hours" value={data.total_hours.toFixed(1)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By Contractor</CardTitle>
          <CardDescription>Hours, jobs worked, and out-of-scope assignments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.by_contractor.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No contractor entries yet.
            </div>
          ) : data.by_contractor.map((row) => (
            <div key={row.contractor_id} className="rounded-lg border p-3">
              <div className="font-medium">{row.contractor_name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {row.hours.toFixed(1)} hours • {row.jobs} jobs • {row.out_of_scope_jobs} out-of-scope
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
