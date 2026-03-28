import { CalendarCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  completed: 'secondary',
  planning: 'outline',
  suspended: 'outline',
};

export function PublicProgramSummary({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; status: string; enrollmentCount: number; attendanceCount: number }>;
}) {
  if (items.length === 0) {
    return (
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>No program groups met the publication threshold.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Programs making a difference in the community.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => {
            const engagement = item.enrollmentCount > 0
              ? Math.min(100, (item.attendanceCount / item.enrollmentCount) * 5)
              : 0;

            return (
              <div key={item.name} className="rounded-2xl bg-secondary/50 p-5">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold flex-1">{item.name}</span>
                  <Badge variant={STATUS_VARIANT[item.status] ?? 'outline'} className="capitalize text-[10px]">
                    {item.status}
                  </Badge>
                </div>

                <div className="flex gap-6 mt-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    <div>
                      <div className="text-2xl font-bold leading-none">{item.enrollmentCount.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">enrolled</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div>
                      <div className="text-2xl font-bold leading-none">{item.attendanceCount.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">sessions</div>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-1">Engagement</div>
                  <Progress value={engagement} className="h-1.5" />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
