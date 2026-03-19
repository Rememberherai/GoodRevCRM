'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, ChevronLeft, ChevronRight, Ban, Clock } from 'lucide-react';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

interface Override {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
  reason: string | null;
}

export default function AvailabilityPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Overrides state
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [overrideMonth, setOverrideMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [overrideForm, setOverrideForm] = useState({
    is_available: false,
    start_time: '09:00',
    end_time: '17:00',
    reason: '',
  });
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const loadOverrides = useCallback(async (year: number, month: number) => {
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    try {
      const res = await fetch(`/api/calendar/availability/overrides?start_date=${startDate}&end_date=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        setOverrides(data.overrides || []);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    loadSchedules();
  }, []);

  useEffect(() => {
    loadOverrides(overrideMonth.year, overrideMonth.month);
  }, [overrideMonth, loadOverrides]);

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

  async function addOverride() {
    if (!selectedDate) return;
    setSavingOverride(true);
    setOverrideError(null);
    try {
      const body: Record<string, unknown> = {
        date: selectedDate,
        is_available: overrideForm.is_available,
        reason: overrideForm.reason || null,
      };
      if (overrideForm.is_available) {
        // Custom hours mode: times are required
        body.start_time = overrideForm.start_time || null;
        body.end_time = overrideForm.end_time || null;
      } else if (overrideForm.start_time) {
        // Block mode with specific hours
        body.start_time = overrideForm.start_time;
        body.end_time = overrideForm.end_time || null;
      } else {
        // Full-day block: send null times
        body.start_time = null;
        body.end_time = null;
      }
      const res = await fetch('/api/calendar/availability/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await loadOverrides(overrideMonth.year, overrideMonth.month);
        setSelectedDate(null);
        setOverrideForm({ is_available: false, start_time: '09:00', end_time: '17:00', reason: '' });
      } else {
        const data = await res.json().catch(() => null);
        setOverrideError(data?.error ? (typeof data.error === 'string' ? data.error : 'Validation failed. Check your inputs.') : 'Failed to add override.');
      }
    } catch {
      setOverrideError('Network error. Please try again.');
    } finally {
      setSavingOverride(false);
    }
  }

  async function deleteOverride(id: string) {
    try {
      const res = await fetch(`/api/calendar/availability/overrides/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadOverrides(overrideMonth.year, overrideMonth.month);
      }
    } catch {
      // Silently fail
    }
  }

  function getCalendarDays(year: number, month: number) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }

  function formatDate(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

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

      {/* Date-Specific Overrides */}
      <Card>
        <CardHeader>
          <CardTitle>Date-Specific Overrides</CardTitle>
          <p className="text-sm text-muted-foreground">
            Block off specific dates or set custom hours that override your weekly schedule.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Mini Calendar */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label="Previous month"
                  onClick={() =>
                    setOverrideMonth((prev) => {
                      const d = new Date(prev.year, prev.month - 1, 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    })
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium">
                  {new Date(overrideMonth.year, overrideMonth.month).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setOverrideMonth((prev) => {
                      const d = new Date(prev.year, prev.month + 1, 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    })
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
                {SHORT_DAY_NAMES.map((d) => (
                  <div key={d} className="py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {getCalendarDays(overrideMonth.year, overrideMonth.month).map((day, idx) => {
                  if (day === null) return <div key={`empty-${idx}`} />;
                  const dateStr = formatDate(overrideMonth.year, overrideMonth.month, day);
                  const dayOverrides = overrides.filter((o) => o.date === dateStr);
                  const hasBlock = dayOverrides.some((o) => !o.is_available);
                  const hasCustom = dayOverrides.some((o) => o.is_available);
                  const isSelected = selectedDate === dateStr;
                  const isPast = dateStr < new Date().toISOString().slice(0, 10);

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      disabled={isPast}
                      onClick={() => { setSelectedDate(isSelected ? null : dateStr); setOverrideError(null); }}
                      className={`
                        relative p-2 text-sm rounded-md transition-colors
                        ${isPast ? 'text-muted-foreground/40 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'}
                        ${isSelected ? 'ring-2 ring-primary bg-primary/10' : ''}
                        ${hasBlock && !isSelected ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400' : ''}
                        ${hasCustom && !hasBlock && !isSelected ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400' : ''}
                      `}
                    >
                      {day}
                      {(hasBlock || hasCustom) && (
                        <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${hasBlock ? 'bg-red-500' : 'bg-blue-500'}`} />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> Blocked
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Custom hours
                </div>
              </div>
            </div>

            {/* Override Form / Existing Overrides */}
            <div>
              {selectedDate ? (
                <div className="space-y-4">
                  <h4 className="font-medium">
                    {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h4>

                  {/* Existing overrides for this date */}
                  {overrides
                    .filter((o) => o.date === selectedDate)
                    .map((o) => (
                      <div
                        key={o.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          o.is_available
                            ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
                            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm">
                          {o.is_available ? (
                            <Clock className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Ban className="h-4 w-4 text-red-600" />
                          )}
                          <span>
                            {o.is_available
                              ? `Available ${o.start_time?.slice(0, 5)} - ${o.end_time?.slice(0, 5)}`
                              : o.start_time
                                ? `Blocked ${o.start_time.slice(0, 5)} - ${o.end_time?.slice(0, 5)}`
                                : 'Full day blocked'}
                          </span>
                          {o.reason && (
                            <span className="text-muted-foreground">— {o.reason}</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove override"
                          onClick={() => deleteOverride(o.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                  {/* Add new override */}
                  <div className="space-y-3 p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Label className="text-sm w-24">Type</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={!overrideForm.is_available ? 'default' : 'outline'}
                          onClick={() => setOverrideForm((f) => ({ ...f, is_available: false, start_time: '09:00', end_time: '17:00' }))}
                        >
                          <Ban className="h-3 w-3 mr-1" /> Block
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={overrideForm.is_available ? 'default' : 'outline'}
                          onClick={() => setOverrideForm((f) => ({ ...f, is_available: true, start_time: f.start_time || '09:00', end_time: f.end_time || '17:00' }))}
                        >
                          <Clock className="h-3 w-3 mr-1" /> Custom hours
                        </Button>
                      </div>
                    </div>

                    {(overrideForm.is_available || overrideForm.start_time) && (
                      <div className="flex items-center gap-2">
                        <Label className="text-sm w-24">Time</Label>
                        <Input
                          type="time"
                          value={overrideForm.start_time}
                          onChange={(e) => setOverrideForm((f) => ({ ...f, start_time: e.target.value }))}
                          className="w-28"
                        />
                        <span className="text-muted-foreground">-</span>
                        <Input
                          type="time"
                          value={overrideForm.end_time}
                          onChange={(e) => setOverrideForm((f) => ({ ...f, end_time: e.target.value }))}
                          className="w-28"
                        />
                      </div>
                    )}

                    {!overrideForm.is_available && (
                      <div className="flex items-center gap-2">
                        <Label className="text-sm w-24">Scope</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant={!overrideForm.start_time ? 'default' : 'outline'}
                          onClick={() => setOverrideForm((f) => ({ ...f, start_time: '', end_time: '' }))}
                        >
                          Full day
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={overrideForm.start_time ? 'default' : 'outline'}
                          onClick={() => setOverrideForm((f) => ({ ...f, start_time: '09:00', end_time: '17:00' }))}
                        >
                          Specific hours
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Label className="text-sm w-24">Reason</Label>
                      <Input
                        value={overrideForm.reason}
                        onChange={(e) => setOverrideForm((f) => ({ ...f, reason: e.target.value }))}
                        placeholder="Optional note (e.g., Vacation, Doctor)"
                        className="flex-1"
                      />
                    </div>

                    {overrideError && (
                      <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 text-sm text-destructive">
                        {overrideError}
                      </div>
                    )}

                    <Button
                      type="button"
                      onClick={addOverride}
                      disabled={savingOverride}
                      size="sm"
                      className="w-full"
                    >
                      {savingOverride ? 'Saving...' : 'Add Override'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Click a date on the calendar to add an override
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
