'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  formatCalendarDateKey,
  formatDateKeyLabel,
  getMonthDateRange,
  getTodayDateKey,
} from '@/lib/calendar/date-utils';
import { LOCATION_TYPE_LABELS } from '@/types/calendar';
import type { PublicCalendarProfile, PublicEventType, TimeSlot, AvailableDay, LocationType, CustomQuestion } from '@/types/calendar';

type Step = 'date' | 'time' | 'form' | 'submitting';

export default function PublicBookingFlowPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const eventTypeSlug = params.eventType as string;

  const [profile, setProfile] = useState<PublicCalendarProfile | null>(null);
  const [eventType, setEventType] = useState<PublicEventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Booking flow state
  const [step, setStep] = useState<Step>('date');
  const [availableDays, setAvailableDays] = useState<AvailableDay[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [inviteeTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Calendar month navigation
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
    responses: {} as Record<string, string>,
  });

  // Load profile + event type
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/book/profile/${slug}`);
        if (!res.ok) {
          setError('Booking page not found');
          return;
        }
        const data = await res.json();
        setProfile(data.profile);
        const et = (data.event_types || []).find(
          (e: PublicEventType) => e.slug === eventTypeSlug
        );
        if (!et) {
          setError('Event type not found');
          return;
        }
        setEventType(et);
      } catch {
        setError('Failed to load booking page');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug, eventTypeSlug]);

  // Load available slots when event type is ready or month changes
  useEffect(() => {
    if (!eventType) return;
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, calendarMonth]);

  async function loadSlots() {
    if (!eventType) return;
    setSlotsLoading(true);
    try {
      const { startDate, endDate } = getMonthDateRange(calendarMonth.year, calendarMonth.month);
      const sp = new URLSearchParams({
        event_type_id: eventType.id,
        start_date: startDate,
        end_date: endDate,
        timezone: inviteeTimezone,
      });
      const res = await fetch(`/api/calendar/slots?${sp}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableDays(data.days || []);
      }
    } catch {
      // Silently fail
    } finally {
      setSlotsLoading(false);
    }
  }

  // Dates with available slots
  const availableDateSet = useMemo(
    () => new Set(availableDays.filter((d) => d.slots.length > 0).map((d) => d.date)),
    [availableDays]
  );

  // Slots for selected date
  const slotsForDate = useMemo(
    () => availableDays.find((d) => d.date === selectedDate)?.slots || [],
    [availableDays, selectedDate]
  );

  // Calendar grid
  const calendarDays = useMemo(() => {
    const first = new Date(calendarMonth.year, calendarMonth.month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate();
    const today = getTodayDateKey(inviteeTimezone);
    const days: Array<{ date: string; day: number; available: boolean; past: boolean } | null> = [];

    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatCalendarDateKey(calendarMonth.year, calendarMonth.month, d);
      days.push({
        date: dateStr,
        day: d,
        available: availableDateSet.has(dateStr),
        past: dateStr < today,
      });
    }
    return days;
  }, [calendarMonth, availableDateSet, inviteeTimezone]);

  const monthLabel = new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setStep('time');
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventType || !selectedSlot) return;

    setStep('submitting');
    setError(null);

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type_id: eventType.id,
          start_at: selectedSlot.start,
          invitee_name: formData.name,
          invitee_email: formData.email,
          invitee_phone: formData.phone || undefined,
          invitee_timezone: inviteeTimezone,
          invitee_notes: formData.notes || undefined,
          responses: Object.keys(formData.responses).length > 0 ? formData.responses : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          setError('This time slot is no longer available. Please select another.');
          setStep('time');
          await loadSlots();
          return;
        }
        if (res.status === 429) {
          setError('Too many booking attempts. Please try again later.');
          setStep('form');
          return;
        }
        setError(data.error || 'Failed to create booking');
        setStep('form');
        return;
      }

      const data = await res.json();
      const confirmParams = new URLSearchParams({
        id: data.booking.id,
        name: formData.name,
        email: formData.email,
        start: selectedSlot.start,
        invitee_timezone: inviteeTimezone,
        duration: String(eventType.duration_minutes),
        title: eventType.title,
        host: profile?.display_name || '',
      });
      if (data.booking.ics_token) {
        confirmParams.set('ics_token', data.booking.ics_token);
      }
      router.push(`/book/confirmation?${confirmParams}`);
    } catch {
      setError('An error occurred. Please try again.');
      setStep('form');
    }
  };

  let parsedQuestions: CustomQuestion[] = [];
  try {
    parsedQuestions = eventType?.custom_questions
      ? (typeof eventType.custom_questions === 'string'
          ? JSON.parse(eventType.custom_questions)
          : (eventType.custom_questions || []))
      : [];
  } catch { parsedQuestions = []; }
  const customQuestions = parsedQuestions;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error && !eventType) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Not Found</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!eventType || !profile) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">{profile.display_name}</p>
        <h1 className="text-2xl font-bold">{eventType.title}</h1>
        {eventType.description && (
          <p className="text-muted-foreground">{eventType.description}</p>
        )}
        <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <span>{eventType.duration_minutes} min</span>
          <span>&middot;</span>
          <span>{LOCATION_TYPE_LABELS[eventType.location_type as LocationType]}</span>
        </div>
      </div>

      {error && step !== 'date' && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Step: Date Selection */}
      {(step === 'date' || step === 'time') && (
        <div className="rounded-lg border bg-white dark:bg-gray-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => {
                const prev = calendarMonth.month === 0
                  ? { year: calendarMonth.year - 1, month: 11 }
                  : { year: calendarMonth.year, month: calendarMonth.month - 1 };
                setCalendarMonth(prev);
              }}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              &larr;
            </button>
            <h2 className="font-semibold">{monthLabel}</h2>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => {
                const next = calendarMonth.month === 11
                  ? { year: calendarMonth.year + 1, month: 0 }
                  : { year: calendarMonth.year, month: calendarMonth.month + 1 };
                setCalendarMonth(next);
              }}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              &rarr;
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-sm mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1 text-muted-foreground font-medium">{d}</div>
            ))}
          </div>

          {slotsLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading availability...</div>
          ) : (
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {calendarDays.map((day, i) =>
                day === null ? (
                  <div key={`empty-${i}`} />
                ) : (
                  <button
                    key={day.date}
                    disabled={!day.available || day.past}
                    onClick={() => handleDateSelect(day.date)}
                    className={`py-2 rounded-lg transition-colors ${
                      selectedDate === day.date
                        ? 'bg-blue-600 text-white'
                        : day.available && !day.past
                          ? 'hover:bg-blue-50 dark:hover:bg-blue-950 text-foreground font-medium'
                          : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {day.day}
                  </button>
                )
              )}
            </div>
          )}

          {/* Time slots for selected date */}
          {step === 'time' && selectedDate && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-medium mb-3">
                Available times for{' '}
                {formatDateKeyLabel(selectedDate, inviteeTimezone, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">{inviteeTimezone}</p>
              {slotsForDate.length === 0 ? (
                <p className="text-muted-foreground text-sm">No available times for this date.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slotsForDate.map((slot) => {
                    const time = new Date(slot.start).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: inviteeTimezone,
                    });
                    return (
                      <button
                        key={slot.start}
                        onClick={() => handleSlotSelect(slot)}
                        className={`py-2 px-3 rounded-lg border text-sm transition-colors ${
                          selectedSlot?.start === slot.start
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950'
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step: Intake Form */}
      {(step === 'form' || step === 'submitting') && selectedSlot && (
        <div className="rounded-lg border bg-white dark:bg-gray-900 p-6">
          <div className="mb-6 pb-4 border-b">
            <p className="text-sm text-muted-foreground">
              {new Date(selectedSlot.start).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                timeZone: inviteeTimezone,
              })}{' '}
              at{' '}
              {new Date(selectedSlot.start).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                timeZone: inviteeTimezone,
              })}
            </p>
            <button
              type="button"
              onClick={() => setStep('time')}
              className="text-sm text-blue-600 hover:underline mt-1"
            >
              Change time
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Name *
              </label>
              <input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email *
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent"
                placeholder="you@example.com"
              />
            </div>

            {eventType.location_type === 'phone' && (
              <div>
                <label htmlFor="phone" className="block text-sm font-medium mb-1">
                  Phone *
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            )}

            {/* Custom questions */}
            {customQuestions.map((q) => (
              <div key={q.id}>
                <label htmlFor={`q-${q.id}`} className="block text-sm font-medium mb-1">
                  {q.label} {q.required && '*'}
                </label>
                {q.type === 'textarea' ? (
                  <textarea
                    id={`q-${q.id}`}
                    required={q.required}
                    value={formData.responses[q.id] || ''}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        responses: { ...f.responses, [q.id]: e.target.value },
                      }))
                    }
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent"
                  />
                ) : q.type === 'select' || q.type === 'radio' ? (
                  <select
                    id={`q-${q.id}`}
                    required={q.required}
                    value={formData.responses[q.id] || ''}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        responses: { ...f.responses, [q.id]: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent"
                  >
                    <option value="">Select...</option>
                    {q.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`q-${q.id}`}
                    type={q.type === 'email' ? 'email' : q.type === 'phone' ? 'tel' : 'text'}
                    required={q.required}
                    value={formData.responses[q.id] || ''}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        responses: { ...f.responses, [q.id]: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent"
                  />
                )}
              </div>
            ))}

            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                Additional notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent"
                placeholder="Anything you'd like to share ahead of the meeting..."
              />
            </div>

            {eventType.cancellation_policy && (
              <p className="text-xs text-muted-foreground">{eventType.cancellation_policy}</p>
            )}

            <button
              type="submit"
              disabled={step === 'submitting'}
              className="w-full rounded-lg bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {step === 'submitting' ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
