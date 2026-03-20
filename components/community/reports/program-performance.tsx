import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProgramPerformanceReport {
  program_id: string;
  program_name: string;
  status: string;
  total_enrolled: number;
  active_enrolled: number;
  completed: number;
  withdrawn: number;
  total_attendance_records: number;
  total_hours: number;
  unique_participants: number;
}

export function ProgramPerformanceReportView({ data }: { data: ProgramPerformanceReport[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Program Performance</CardTitle>
        <CardDescription>
          Enrollment, attendance dosage, and unduplicated participation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No program data yet.
          </div>
        ) : data.map((program) => (
          <div key={program.program_id} className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">{program.program_name}</div>
                <div className="text-sm text-muted-foreground">
                  {program.total_attendance_records} attendance records • {program.total_hours.toFixed(1)} hours
                </div>
              </div>
              <Badge variant="secondary">{program.status}</Badge>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <Metric label="Enrolled" value={program.total_enrolled} />
              <Metric label="Active" value={program.active_enrolled} />
              <Metric label="Completed" value={program.completed} />
              <Metric label="Unique" value={program.unique_participants} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
