'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Rule {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Schedule {
  id: string;
  name: string;
  timezone: string;
  is_default: boolean;
  availability_rules: Rule[];
}

export default function AvailabilityPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSchedules();
  }, []);

  async function loadSchedules() {
    try {
      const res = await fetch('/api/calendar/availability/schedules');
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  async function createDefaultSchedule() {
    setSaving(true);
    try {
      const res = await fetch('/api/calendar/availability/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Working Hours',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          is_default: true,
          rules: [1, 2, 3, 4, 5].map((day) => ({
            day_of_week: day,
            start_time: '09:00',
            end_time: '17:00',
          })),
        }),
      });

      if (res.ok) {
        await loadSchedules();
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule(schedule: Schedule) {
    setSaving(true);
    try {
      const res = await fetch(`/api/calendar/availability/schedules/${schedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: schedule.name,
          timezone: schedule.timezone,
          is_default: schedule.is_default,
          rules: schedule.availability_rules.map((r) => ({
            day_of_week: r.day_of_week,
            start_time: r.start_time,
            end_time: r.end_time,
          })),
        }),
      });
      if (!res.ok) {
        alert('Failed to save schedule. Please try again.');
        return;
      }
      await loadSchedules();
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }

  const updateRule = (schedIdx: number, ruleIdx: number, partial: Partial<Rule>) => {
    setSchedules((prev) => {
      const next = [...prev];
      const src = next[schedIdx]!;
      const rules = [...src.availability_rules];
      rules[ruleIdx] = { ...rules[ruleIdx]!, ...partial };
      next[schedIdx] = { ...src, availability_rules: rules };
      return next;
    });
  };

  const addRule = (schedIdx: number, dayOfWeek: number) => {
    setSchedules((prev) => {
      const next = [...prev];
      const src = next[schedIdx]!;
      next[schedIdx] = {
        ...src,
        availability_rules: [
          ...src.availability_rules,
          { day_of_week: dayOfWeek, start_time: '09:00', end_time: '17:00' },
        ],
      };
      return next;
    });
  };

  const removeRule = (schedIdx: number, ruleIdx: number) => {
    setSchedules((prev) => {
      const next = [...prev];
      const src = next[schedIdx]!;
      next[schedIdx] = {
        ...src,
        availability_rules: src.availability_rules.filter((_, i) => i !== ruleIdx),
      };
      return next;
    });
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading availability...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Availability</h1>
      </div>

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold mb-2">No availability schedule</h3>
            <p className="text-muted-foreground mb-4">
              Set up your working hours to start accepting bookings.
            </p>
            <Button onClick={createDefaultSchedule} disabled={saving}>
              {saving ? 'Creating...' : 'Create Default Schedule (Mon-Fri 9-5)'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        schedules.map((schedule, schedIdx) => (
          <Card key={schedule.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle>{schedule.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{schedule.timezone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Default</Label>
                  <Switch checked={schedule.is_default} disabled />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {DAY_NAMES.map((dayName, dayIdx) => {
                const dayRules = schedule.availability_rules
                  .map((r, i) => ({ ...r, _idx: i }))
                  .filter((r) => r.day_of_week === dayIdx);

                return (
                  <div key={dayIdx} className="flex items-start gap-4">
                    <div className="w-28 pt-2 text-sm font-medium">{dayName}</div>
                    <div className="flex-1 space-y-2">
                      {dayRules.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">Unavailable</p>
                      ) : (
                        dayRules.map((rule) => (
                          <div key={rule._idx} className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={rule.start_time.slice(0, 5)}
                              onChange={(e) =>
                                updateRule(schedIdx, rule._idx, { start_time: e.target.value })
                              }
                              className="w-32"
                            />
                            <span className="text-muted-foreground">-</span>
                            <Input
                              type="time"
                              value={rule.end_time.slice(0, 5)}
                              onChange={(e) =>
                                updateRule(schedIdx, rule._idx, { end_time: e.target.value })
                              }
                              className="w-32"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove ${dayName} time slot`}
                              onClick={() => removeRule(schedIdx, rule._idx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addRule(schedIdx, dayIdx)}
                        className="text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add hours
                      </Button>
                    </div>
                  </div>
                );
              })}

              <div className="pt-4 border-t">
                <Button
                  onClick={() => saveSchedule(schedule)}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Schedule'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
