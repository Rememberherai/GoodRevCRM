'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  formatCalendarDateKey,
  getMonthDateRange,
  getTodayDateKey,
} from '@/lib/calendar/date-utils';
import { LOCATION_TYPE_LABELS } from '@/types/calendar';
import type { PublicEventType, TimeSlot, AvailableDay, LocationType, CustomQuestion } from '@/types/calendar';

type Step = 'date' | 'time' | 'form' | 'submitting' | 'success';

export default function EmbedBookingPage() {
  const params = useParams();
  const slug = params.slug as string;
  const eventTypeSlug = params.eventType as string;

  const [eventType, setEventType] = useState<PublicEventType | null>(null);
  const [hostName, setHostName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('date');
  const [availableDays, setAvailableDays] = useState<AvailableDay[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [inviteeTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
    responses: {} as Record<string, string>,
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/book/profile/${slug}`);
        if (!res.ok) {
          setError('Not found');
          return;
        }
        const data = await res.json();
        setHostName(data.profile?.display_name || '');
        const et = (data.event_types || []).find(
          (e: PublicEventType) => e.slug === eventTypeSlug
        );
        if (!et) {
          setError('Event type not found');
          return;
        }
        setEventType(et);
      } catch {
        setError('Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug, eventTypeSlug]);

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

  const availableDateSet = useMemo(
    () => new Set(availableDays.filter((d) => d.slots.length > 0).map((d) => d.date)),
    [availableDays]
  );

  const slotsForDate = useMemo(
    () => availableDays.find((d) => d.date === selectedDate)?.slots || [],
    [availableDays, selectedDate]
  );

  const calendarDays = useMemo(() => {
    const first = new Date(calendarMonth.year, calendarMonth.month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate();
    const today = getTodayDateKey(inviteeTimezone);
    const days: Array<{ date: string; day: number; available: boolean; past: boolean } | null> = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatCalendarDateKey(calendarMonth.year, calendarMonth.month, d);
      days.push({ date: dateStr, day: d, available: availableDateSet.has(dateStr), past: dateStr < today });
    }
    return days;
  }, [calendarMonth, availableDateSet, inviteeTimezone]);

  const monthLabel = new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  let parsedQuestions: CustomQuestion[] = [];
  try {
    parsedQuestions = eventType?.custom_questions
      ? (typeof eventType.custom_questions === 'string'
          ? JSON.parse(eventType.custom_questions)
          : (eventType.custom_questions || []))
      : [];
  } catch { parsedQuestions = []; }
  const customQuestions = parsedQuestions;

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
          setError('This time slot is no longer available.');
          setStep('time');
          await loadSlots();
          return;
        }
        setError(data.error || 'Failed to book');
        setStep('form');
        return;
      }

      setStep('success');
      // Notify parent frame
      try {
        window.parent.postMessage({ type: 'goodrev:booking:complete', slug, eventType: eventTypeSlug }, '*');
      } catch {
        // Not in iframe or blocked
      }
    } catch {
      setError('An error occurred.');
      setStep('form');
    }
  };

  if (loading) return <div className="p-4 text-center text-sm text-gray-500">Loading...</div>;
  if (error && !eventType) return <div className="p-4 text-center text-sm text-gray-500">{error}</div>;
  if (!eventType) return null;

  if (step === 'success') {
    return (
      <div className="p-6 text-center space-y-3">
        <div className="text-3xl">&#10003;</div>
        <h2 className="text-lg font-bold">Meeting Scheduled</h2>
        <p className="text-sm text-gray-500">A confirmation email has been sent.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 text-sm">
      {/* Header */}
      <div className="text-center space-y-1">
        <p className="text-xs text-gray-500">{hostName}</p>
        <h1 className="text-lg font-bold">{eventType.title}</h1>
        <p className="text-xs text-gray-500">
          {eventType.duration_minutes} min &middot; {LOCATION_TYPE_LABELS[eventType.location_type as LocationType]}
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>
      )}

      {/* Date/Time picker */}
      {(step === 'date' || step === 'time') && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => {
                const prev = calendarMonth.month === 0
                  ? { year: calendarMonth.year - 1, month: 11 }
                  : { year: calendarMonth.year, month: calendarMonth.month - 1 };
                setCalendarMonth(prev);
              }}
              className="p-1 rounded hover:bg-gray-100"
            >
              &larr;
            </button>
            <span className="font-medium text-xs">{monthLabel}</span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => {
                const next = calendarMonth.month === 11
                  ? { year: calendarMonth.year + 1, month: 0 }
                  : { year: calendarMonth.year, month: calendarMonth.month + 1 };
                setCalendarMonth(next);
              }}
              className="p-1 rounded hover:bg-gray-100"
            >
              &rarr;
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-xs mb-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="py-0.5 text-gray-400">{d}</div>
            ))}
          </div>

          {slotsLoading ? (
            <div className="py-4 text-center text-xs text-gray-400">Loading...</div>
          ) : (
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
              {calendarDays.map((day, i) =>
                day === null ? (
                  <div key={`e-${i}`} />
                ) : (
                  <button
                    key={day.date}
                    disabled={!day.available || day.past}
                    onClick={() => {
                      setSelectedDate(day.date);
                      setSelectedSlot(null);
                      setStep('time');
                    }}
                    className={`py-1.5 rounded transition-colors ${
                      selectedDate === day.date
                        ? 'bg-blue-600 text-white'
                        : day.available && !day.past
                          ? 'hover:bg-blue-50 font-medium'
                          : 'text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {day.day}
                  </button>
                )
              )}
            </div>
          )}

          {step === 'time' && selectedDate && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-500 mb-2">{inviteeTimezone}</p>
              {slotsForDate.length === 0 ? (
                <p className="text-xs text-gray-400">No times available.</p>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {slotsForDate.map((slot) => {
                    const time = new Date(slot.start).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: inviteeTimezone,
                    });
                    return (
                      <button
                        key={slot.start}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setStep('form');
                        }}
                        className={`py-1.5 rounded border text-xs transition-colors ${
                          selectedSlot?.start === slot.start
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'hover:border-blue-400'
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

      {/* Form */}
      {(step === 'form' || step === 'submitting') && selectedSlot && (
        <div>
          <div className="mb-3 pb-2 border-b">
            <p className="text-xs text-gray-500">
              {new Date(selectedSlot.start).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                timeZone: inviteeTimezone,
              })}{' '}
              at{' '}
              {new Date(selectedSlot.start).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                timeZone: inviteeTimezone,
              })}
            </p>
            <button type="button" onClick={() => setStep('time')} className="text-xs text-blue-600 hover:underline">
              Change
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              required
              aria-label="Name"
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded border px-2.5 py-1.5 text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Name *"
            />
            <input
              type="email"
              required
              aria-label="Email"
              value={formData.email}
              onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded border px-2.5 py-1.5 text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Email *"
            />
            {eventType.location_type === 'phone' && (
              <input
                type="tel"
                required
                aria-label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded border px-2.5 py-1.5 text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Phone *"
              />
            )}
            {customQuestions.map((q) => (
              <div key={q.id}>
                {q.type === 'textarea' ? (
                  <textarea
                    required={q.required}
                    aria-label={q.label}
                    value={formData.responses[q.id] || ''}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        responses: { ...f.responses, [q.id]: e.target.value },
                      }))
                    }
                    rows={2}
                    className="w-full rounded border px-2.5 py-1.5 text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder={`${q.label}${q.required ? ' *' : ''}`}
                  />
                ) : q.type === 'select' || q.type === 'radio' ? (
                  <select
                    required={q.required}
                    aria-label={q.label}
                    value={formData.responses[q.id] || ''}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        responses: { ...f.responses, [q.id]: e.target.value },
                      }))
                    }
                    className="w-full rounded border px-2.5 py-1.5 text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">{q.label}{q.required ? ' *' : ''}</option>
                    {q.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    type={q.type === 'email' ? 'email' : q.type === 'phone' ? 'tel' : 'text'}
                    required={q.required}
                    aria-label={q.label}
                    value={formData.responses[q.id] || ''}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        responses: { ...f.responses, [q.id]: e.target.value },
                      }))
                    }
                    className="w-full rounded border px-2.5 py-1.5 text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder={`${q.label}${q.required ? ' *' : ''}`}
                  />
                )}
              </div>
            ))}
            <textarea
              aria-label="Additional notes"
              value={formData.notes}
              onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded border px-2.5 py-1.5 text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Additional notes"
            />
            <button
              type="submit"
              disabled={step === 'submitting'}
              className="w-full rounded bg-blue-600 text-white py-2 text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {step === 'submitting' ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
          </form>
        </div>
      )}

      <p className="text-center text-[10px] text-gray-400">Powered by GoodRev</p>
    </div>
  );
}
