'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

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

const enrollmentConfig = {
  active: { label: 'Active', color: 'var(--color-blue-500)' },
  completed: { label: 'Completed', color: 'var(--color-green-500)' },
  withdrawn: { label: 'Withdrawn', color: 'var(--color-red-400)' },
} satisfies ChartConfig;

const hoursConfig = {
  hours: { label: 'Hours', color: 'var(--color-amber-500)' },
} satisfies ChartConfig;

export function ProgramPerformanceReportView({ data }: { data: ProgramPerformanceReport[] }) {
  const chartData = useMemo(
    () =>
      data.map((p) => ({
        name: p.program_name.length > 20 ? p.program_name.substring(0, 18) + '...' : p.program_name,
        fullName: p.program_name,
        active: p.active_enrolled,
        completed: p.completed,
        withdrawn: p.withdrawn,
        hours: p.total_hours,
        participants: p.unique_participants,
      })),
    [data]
  );

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Program Performance</CardTitle>
          <CardDescription>No program data yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enrollment by Program</CardTitle>
            <CardDescription>Active, completed, and withdrawn enrollments</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={enrollmentConfig} className="aspect-auto h-[280px] w-full">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    className="text-xs"
                    width={120}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="active" name="active" stackId="enrollment" fill="var(--color-blue-500)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="completed" name="completed" stackId="enrollment" fill="var(--color-green-500)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="withdrawn" name="withdrawn" stackId="enrollment" fill="var(--color-red-400)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hours by Program</CardTitle>
            <CardDescription>Total attendance hours per program</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={hoursConfig} className="aspect-auto h-[280px] w-full">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs" angle={-30} textAnchor="end" height={60} />
                  <YAxis tickLine={false} axisLine={false} className="text-xs" width={50} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={((value: number) => `${value.toFixed(1)} hrs`) as never}
                      />
                    }
                  />
                  <Bar dataKey="hours" name="hours" fill="var(--color-amber-500)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Program Details</CardTitle>
          <CardDescription>Enrollment, attendance dosage, and unduplicated participation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.map((program) => (
            <div key={program.program_id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{program.program_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {program.total_attendance_records} attendance records &bull; {program.total_hours.toFixed(1)} hours
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
    </div>
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
