import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PublicContributionSummary({
  title,
  items,
}: {
  title: string;
  items: Array<{ type: string; totalValue: number; count: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No contribution groups met the publication threshold.</div>
        ) : (
          items.map((item) => (
            <div key={item.type} className="rounded-lg border p-4">
              <div className="font-medium capitalize">{item.type.replace(/_/g, ' ')}</div>
              <div className="text-sm text-muted-foreground">
                {item.count.toLocaleString()} records • ${item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
