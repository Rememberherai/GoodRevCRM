'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  formatCalendarDateKey,
  formatDateKeyLabel,
  getMonthDateRange,
  getTodayDateKey,
} from '@/lib/calendar/date-utils';
import type { TimeSlot, AvailableDay } from '@/types/calendar';

type Step = 'loading' | 'date' | 'time' | 'submitting' | 'error' | 'expired';

export default function RescheduleBookingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [step, setStep] = useState<Step>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  // Booking info (fetched from token)
  const [bookingInfo, setBookingInfo] = useState<{
    event_type_id: string;
    event_type_title: string;
    duration_minutes: number;
    host_name: string;
    invitee_name?: string;
    invitee_email?: string;
  } | null>(null);

  const [availableDays, setAvailableDays] = useState<AvailableDay[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [inviteeTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Validate token and get booking info
  useEffect(() => {
    async function validate() {
      try {
        // Use the reschedule endpoint with GET-like validation
        // We'll check the token by attempting to load booking info
        const res = await fetch(`/api/book/reschedule?token=${token}`);
        if (res.status === 410) {
          setStep('expired');
          return;
        }
        if (!res.ok) {
          setErrorMessage('Invalid or expired reschedule link.');
          setStep('error');
          return;
        }
        const data = await res.json();
        setBookingInfo(data.booking);
        setStep('date');
      } catch {
        setErrorMessage('Failed to load booking information.');
        setStep('error');
      }
    }
    validate();
  }, [token]);

  // Load slots when booking info available or month changes
  useEffect(() => {
    if (!bookingInfo) return;
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingInfo, calendarMonth]);

  async function loadSlots() {
    if (!bookingInfo) return;
    setSlotsLoading(true);
    try {
      const { startDate, endDate } = getMonthDateRange(calendarMonth.year, calendarMonth.month);
      const sp = new URLSearchParams({
        event_type_id: bookingInfo.event_type_id,
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

  const handleReschedule = async () => {
    setErrorMessage('');
    if (!selectedSlot) return;
    setStep('submitting');

    try {
      const res = await fetch('/api/book/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          new_start_at: selectedSlot.start,
        }),
      });

      if (res.status === 410) {
        setStep('expired');
        return;
      }

      if (res.status === 409) {
        setErrorMessage('This time slot is no longer available. Please select another.');
        setStep('time');
        await loadSlots();
        return;
      }

      if (!res.ok) {
        let msg = 'Failed to reschedule';
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch {
          // Response body may not be JSON
        }
        setErrorMessage(msg);
        setStep('date');
        return;
      }

      const data = await res.json();
      const confirmParams = new URLSearchParams({
        id: data.booking.id,
        start: selectedSlot.start,
        invitee_timezone: inviteeTimezone,
        duration: String(bookingInfo?.duration_minutes || 30),
        title: bookingInfo?.event_type_title || 'Meeting',
        host: bookingInfo?.host_name || '',
        rescheduled: 'true',
        ...(bookingInfo?.invitee_name ? { name: bookingInfo.invitee_name } : {}),
        ...(bookingInfo?.invitee_email ? { email: bookingInfo.invitee_email } : {}),
      });
      if (data.booking.ics_token) {
        confirmParams.set('ics_token', data.booking.ics_token);
      }
      router.push(`/book/confirmation?${confirmParams}`);
    } catch {
      setErrorMessage('An error occurred. Please try again.');
      setStep('date');
    }
  };

  if (step === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (step === 'expired') {
    return (
      <div className="text-center py-12 space-y-4">
        <h1 className="text-2xl font-bold">Link Expired</h1>
        <p className="text-muted-foreground">
          This reschedule link has expired. The meeting may have already started.
          Please contact the host directly.
        </p>
      </div>
    );
  }

  if (step === 'error' && !bookingInfo) {
    return (
      <div className="text-center py-12 space-y-4">
        <h1 className="text-2xl font-bold">Invalid Link</h1>
        <p className="text-muted-foreground">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Reschedule Meeting</h1>
        {bookingInfo && (
          <p className="text-muted-foreground mt-2">
            {bookingInfo.event_type_title} with {bookingInfo.host_name} &middot;{' '}
            {bookingInfo.duration_minutes} min
          </p>
        )}
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      <div className="rounded-lg border bg-white dark:bg-gray-900 p-6">
        {/* Calendar */}
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
                  onClick={() => {
                    setSelectedDate(day.date);
                    setSelectedSlot(null);
                    setErrorMessage('');
                    setStep('time');
                  }}
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

        {/* Time slots */}
        {(step === 'time' || step === 'submitting') && selectedDate && (
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
                      onClick={() => setSelectedSlot(slot)}
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

            {selectedSlot && (
              <button
                onClick={handleReschedule}
                disabled={step === 'submitting'}
                className="w-full mt-4 rounded-lg bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {step === 'submitting' ? 'Rescheduling...' : 'Confirm New Time'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
