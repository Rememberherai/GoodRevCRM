import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CommunityDashboardProgram } from '@/lib/community/dashboard';

interface ProgramCardsProps {
  programs: CommunityDashboardProgram[];
}

export function ProgramCards({ programs }: ProgramCardsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Program Performance</CardTitle>
        <CardDescription>
          Current program enrollment and status snapshot.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {programs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No programs yet. Program cards will appear here once Phase 3 program management is in place.
          </div>
        ) : (
          programs.map((program) => {
            const percentage = program.capacity && program.capacity > 0
              ? Math.min(100, Math.round((program.enrollmentCount / program.capacity) * 100))
              : null;

            return (
              <div key={program.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">{program.name}</div>
                    <div className="text-sm text-muted-foreground capitalize">{program.status}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {program.enrollmentCount}
                    {program.capacity ? ` / ${program.capacity}` : ''} enrolled
                  </div>
                </div>
                {percentage !== null && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${percentage}%` }} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
