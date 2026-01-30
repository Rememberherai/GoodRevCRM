'use client';

import { format } from 'date-fns';
import { User, Target, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RecentPerson {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  created_at: string;
}

interface RecentOpportunity {
  id: string;
  name: string;
  stage: string | null;
  value: number | null;
  created_at: string;
}

interface RecentTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
}

interface RecentActivityProps {
  people: RecentPerson[];
  opportunities: RecentOpportunity[];
  tasks: RecentTask[];
  projectSlug: string;
}

const stageColors: Record<string, string> = {
  lead: 'bg-slate-100 text-slate-800',
  qualified: 'bg-blue-100 text-blue-800',
  proposal: 'bg-purple-100 text-purple-800',
  negotiation: 'bg-orange-100 text-orange-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
};

const priorityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

export function RecentActivity({
  people,
  opportunities,
  tasks,
  projectSlug,
}: RecentActivityProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Recent People */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Recent People
          </CardTitle>
          <CardDescription>Newly added contacts</CardDescription>
        </CardHeader>
        <CardContent>
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent people
            </p>
          ) : (
            <div className="space-y-3">
              {people.map((person) => (
                <a
                  key={person.id}
                  href={`/projects/${projectSlug}/people/${person.id}`}
                  className="block p-2 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <p className="font-medium text-sm">
                    {person.first_name} {person.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {person.email ?? 'No email'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(person.created_at), 'MMM d, h:mm a')}
                  </p>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Opportunities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            Recent Opportunities
          </CardTitle>
          <CardDescription>Latest deals</CardDescription>
        </CardHeader>
        <CardContent>
          {opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent opportunities
            </p>
          ) : (
            <div className="space-y-3">
              {opportunities.map((opp) => (
                <a
                  key={opp.id}
                  href={`/projects/${projectSlug}/opportunities/${opp.id}`}
                  className="block p-2 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{opp.name}</p>
                    {opp.stage && (
                      <Badge
                        variant="secondary"
                        className={stageColors[opp.stage] ?? ''}
                      >
                        {opp.stage}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {opp.value
                      ? `$${opp.value.toLocaleString()}`
                      : 'No value set'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(opp.created_at), 'MMM d, h:mm a')}
                  </p>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckSquare className="h-4 w-4" />
            Recent Tasks
          </CardTitle>
          <CardDescription>Latest tasks</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent tasks
            </p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    <Badge
                      variant="secondary"
                      className={priorityColors[task.priority] ?? ''}
                    >
                      {task.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">
                    {task.status.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(task.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
