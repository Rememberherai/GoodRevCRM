import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CommunityDashboardActivityItem } from '@/lib/community/dashboard';

interface ActivityFeedProps {
  items: CommunityDashboardActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Latest community project events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No community activity yet. This feed will populate as households, enrollments, and contributions are added.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 border-b pb-4 last:border-b-0 last:pb-0">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="text-sm text-muted-foreground">{item.description}</div>
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
