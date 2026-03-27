'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CalendarDays, ExternalLink } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface GrantRecord {
  id: string;
  name: string;
  status: string;
  loi_due_at: string | null;
  application_due_at: string | null;
  report_due_at: string | null;
}

interface DeadlineItem {
  grantId: string;
  grantName: string;
  status: string;
  type: 'LOI' | 'Application' | 'Report';
  date: Date;
}

const STATUS_COLORS: Record<string, string> = {
  researching: 'bg-slate-100 text-slate-700',
  preparing: 'bg-blue-100 text-blue-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  under_review: 'bg-orange-100 text-orange-700',
  awarded: 'bg-green-100 text-green-700',
  active: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-gray-100 text-gray-700',
  declined: 'bg-red-100 text-red-700',
  not_a_fit: 'bg-orange-100 text-orange-700',
};

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function GrantsCalendarClient() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [visibleTypes, setVisibleTypes] = useState({ LOI: true, Application: true, Report: true });

  const fetchGrants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/grants?limit=500&discovered=false`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setGrants(data.grants ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchGrants(); }, [fetchGrants]);

  // Build all deadline items
  const allDeadlines = useMemo<DeadlineItem[]>(() => {
    const items: DeadlineItem[] = [];
    for (const g of grants) {
      if (g.loi_due_at) items.push({ grantId: g.id, grantName: g.name, status: g.status, type: 'LOI', date: new Date(g.loi_due_at) });
      if (g.application_due_at) items.push({ grantId: g.id, grantName: g.name, status: g.status, type: 'Application', date: new Date(g.application_due_at) });
      if (g.report_due_at) items.push({ grantId: g.id, grantName: g.name, status: g.status, type: 'Report', date: new Date(g.report_due_at) });
    }
    return items;
  }, [grants]);

  const filteredDeadlines = useMemo(() =>
    allDeadlines.filter((d) => visibleTypes[d.type]),
    [allDeadlines, visibleTypes]
  );

  // Build date → deadlines map
  const deadlinesByDay = useMemo(() => {
    const map = new Map<string, DeadlineItem[]>();
    for (const d of filteredDeadlines) {
      const key = toDateKey(d.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [filteredDeadlines]);

  const deadlineDates = useMemo(() =>
    filteredDeadlines.map((d) => d.date),
    [filteredDeadlines]
  );

  const loiDates = useMemo(() =>
    filteredDeadlines.filter((d) => d.type === 'LOI').map((d) => d.date),
    [filteredDeadlines]
  );
  const appDates = useMemo(() =>
    filteredDeadlines.filter((d) => d.type === 'Application').map((d) => d.date),
    [filteredDeadlines]
  );
  const reportDates = useMemo(() =>
    filteredDeadlines.filter((d) => d.type === 'Report').map((d) => d.date),
    [filteredDeadlines]
  );

  const selectedDayDeadlines = selectedDay
    ? (deadlinesByDay.get(toDateKey(selectedDay)) ?? [])
    : [];

  function toggleType(type: keyof typeof visibleTypes) {
    setVisibleTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-80 w-full max-w-md" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <CalendarDays className="h-6 w-6" />
          Grant Deadlines
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          All LOI, application, and report deadlines across your pipeline
        </p>
      </div>

      {/* Legend / toggles */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Show:</span>
        {(['LOI', 'Application', 'Report'] as const).map((type) => {
          const color = type === 'LOI' ? 'bg-blue-500' : type === 'Application' ? 'bg-orange-500' : 'bg-purple-500';
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-full border transition-opacity ${visibleTypes[type] ? 'opacity-100' : 'opacity-40'}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
              {type}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Calendar */}
        <Card className="shrink-0">
          <CardContent className="p-3">
            <DayPicker
              mode="single"
              selected={selectedDay ?? undefined}
              onSelect={(day) => setSelectedDay(day ?? null)}
              modifiers={{
                hasDeadline: deadlineDates,
                hasLoi: loiDates,
                hasApp: appDates,
                hasReport: reportDates,
              }}
              modifiersClassNames={{
                hasDeadline: 'rdp-day-has-deadline',
              }}
              components={{
                DayContent: ({ date }: { date: Date }) => {
                  const key = toDateKey(date);
                  const items = deadlinesByDay.get(key) ?? [];
                  const types = new Set(items.map((i) => i.type));
                  return (
                    <div className="relative flex flex-col items-center">
                      <span>{date.getDate()}</span>
                      {items.length > 0 && (
                        <div className="flex gap-0.5 absolute -bottom-1">
                          {types.has('LOI') && <span className="h-1 w-1 rounded-full bg-blue-500" />}
                          {types.has('Application') && <span className="h-1 w-1 rounded-full bg-orange-500" />}
                          {types.has('Report') && <span className="h-1 w-1 rounded-full bg-purple-500" />}
                        </div>
                      )}
                    </div>
                  );
                },
              } as Parameters<typeof DayPicker>[0]['components']}
            />
          </CardContent>
        </Card>

        {/* Day detail panel */}
        <div className="flex-1 min-w-0">
          {selectedDay ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDayDeadlines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No deadlines on this day.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedDayDeadlines.map((item, i) => (
                      <div
                        key={`${item.grantId}-${item.type}-${i}`}
                        className="flex items-start justify-between gap-3 py-2 border-b last:border-0"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${item.type === 'LOI' ? 'bg-blue-500' : item.type === 'Application' ? 'bg-orange-500' : 'bg-purple-500'}`}
                            />
                            <span className="text-xs font-medium text-muted-foreground">{item.type}</span>
                            <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-700'}`}>
                              {item.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="font-medium text-sm mt-0.5 truncate">{item.grantName}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => router.push(`/projects/${slug}/grants/${item.grantId}`)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Click a day on the calendar to see its deadlines
            </div>
          )}

          {/* Upcoming deadlines list */}
          <div className="mt-4 space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Upcoming (next 30 days)</h2>
            {(() => {
              const today = new Date();
              const in30 = new Date(today);
              in30.setDate(in30.getDate() + 30);
              const upcoming = filteredDeadlines
                .filter((d) => d.date >= today && d.date <= in30)
                .sort((a, b) => a.date.getTime() - b.date.getTime());
              if (upcoming.length === 0) return (
                <p className="text-sm text-muted-foreground">No deadlines in the next 30 days.</p>
              );
              return upcoming.map((item, i) => {
                const daysUntil = Math.ceil((item.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <button
                    key={`upcoming-${item.grantId}-${item.type}-${i}`}
                    className="w-full text-left flex items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-accent transition-colors"
                    onClick={() => router.push(`/projects/${slug}/grants/${item.grantId}`)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${item.type === 'LOI' ? 'bg-blue-500' : item.type === 'Application' ? 'bg-orange-500' : 'bg-purple-500'}`} />
                      <span className="text-sm truncate">{item.grantName}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{item.type}</span>
                    </div>
                    <span className={`text-xs shrink-0 font-medium ${daysUntil <= 7 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
                    </span>
                  </button>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
