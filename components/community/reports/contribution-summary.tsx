import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ContributionSummaryReport {
  by_type: { type: string; count: number; total_value: number; total_hours: number }[];
  by_dimension: { dimension_id: string; dimension_label: string; count: number; total_value: number }[];
  by_status: { status: string; count: number; total_value: number }[];
}

export function ContributionSummaryReportView({ data }: { data?: ContributionSummaryReport }) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contribution Summary</CardTitle>
          <CardDescription>No contribution data yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SummaryCard
        title="By Type"
        description="Monetary, in-kind, grant, service, and volunteer entries."
        rows={data.by_type.map((row) => ({
          label: row.type.replaceAll('_', ' '),
          value: `${row.count} • $${row.total_value.toFixed(2)}`,
        }))}
      />
      <SummaryCard
        title="By Dimension"
        description="Impact dimensions receiving the most recorded value."
        rows={data.by_dimension.map((row) => ({
          label: row.dimension_label,
          value: `${row.count} • $${row.total_value.toFixed(2)}`,
        }))}
      />
      <SummaryCard
        title="By Status"
        description="Pledged, received, completed, or cancelled value."
        rows={data.by_status.map((row) => ({
          label: row.status,
          value: `${row.count} • $${row.total_value.toFixed(2)}`,
        }))}
      />
    </div>
  );
}

function SummaryCard({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No data yet.
          </div>
        ) : rows.map((row) => (
          <div key={`${title}-${row.label}`} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="text-sm font-medium capitalize">{row.label}</div>
            <div className="text-sm text-muted-foreground">{row.value}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
