import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PublicProgramSummary({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; status: string; enrollmentCount: number; attendanceCount: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No program groups met the publication threshold.</div>
        ) : (
          items.map((item) => (
            <div key={item.name} className="rounded-lg border p-4">
              <div className="font-medium">{item.name}</div>
              <div className="text-sm text-muted-foreground">
                <span className="capitalize">{item.status}</span> • {item.enrollmentCount.toLocaleString()} enrollments • {item.attendanceCount.toLocaleString()} attendance records
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
