import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PublicBarChart({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number; color?: string | null }>;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No aggregate groups met the minimum threshold.</div>
        ) : (
          items.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{item.label}</span>
                <span>${item.value.toLocaleString()}</span>
              </div>
              <div className="h-3 rounded-full bg-muted">
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: `${(item.value / max) * 100}%`,
                    backgroundColor: item.color ?? '#0f766e',
                  }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
