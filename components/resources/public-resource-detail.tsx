'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Key, Info } from 'lucide-react';
import Link from 'next/link';
import {
  formatCalendarDateKey,
  getMonthDateRange,
  getTodayDateKey,
} from '@/lib/calendar/date-utils';
import type { AvailableDay, TimeSlot } from '@/types/calendar';

type Step = 'preset' | 'date' | 'time' | 'form' | 'submitting' | 'done';

interface Preset {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  custom_questions: unknown;
}

interface AssetInfo {
  id: string;
  name: string;
  description: string | null;
  access_mode: string;
  approval_policy: string;
  concurrent_capacity: number;
  return_required: boolean;
  access_instructions: string | null;
}

interface CustomQuestion {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

const POLICY_LABELS: Record<string, string> = {
  open_auto: 'Instant confirmation',
  open_review: 'Requires approval',
  approved_only: 'Pre-approval required',
};

export function PublicResourceDetail({
  asset,
  presets,
  timezone,
  hubSlug,
  resourceSlug,
}: {
  asset: AssetInfo;
  presets: Preset[];
  timezone: string;
  hubSlug: string;
  resourceSlug: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(presets.length === 1 ? 'date' : 'preset');
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(
    presets.length === 1 ? presets[0] ?? null : null
  );

  // Date/time selection
  const [availableDays, setAvailableDays] = useState<AvailableDay[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [inviteeTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const displayTimezone = timezone;

  // Calendar navigation
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Form
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    responses: {} as Record<string, string>,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Load slots when preset or month changes ──────────────────

  const loadSlots = useCallback(async () => {
    if (!selectedPreset) return;
    setSlotsLoading(true);
    try {
      const { startDate, endDate } = getMonthDateRange(calendarMonth.year, calendarMonth.month);
      const params = new URLSearchParams({
        event_type_id: selectedPreset.id,
        start_date: startDate,
        end_date: endDate,
        timezone: inviteeTimezone,
      });
      const res = await fetch(`/api/resources/${hubSlug}/${resourceSlug}/slots?${params}`);
      if (res.ok) {
        const json = await res.json() as { days: AvailableDay[] };
        setAvailableDays(json.days || []);
      }
    } catch {
      // Silently fail — user sees no available slots
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedPreset, calendarMonth, hubSlug, resourceSlug, inviteeTimezone]);

  useEffect(() => {
    if (step === 'date' && selectedPreset) {
      loadSlots();
    }
  }, [step, selectedPreset, loadSlots]);

  // ── Calendar data ────────────────────────────────────────────

  const todayKey = useMemo(() => getTodayDateKey(inviteeTimezone), [inviteeTimezone]);
  const availableDateSet = useMemo(
    () => new Set(availableDays.map((d) => d.date)),
    [availableDays]
  );

  const selectedDaySlots = useMemo(() => {
    if (!selectedDate) return [];
    return availableDays.find((d) => d.date === selectedDate)?.slots || [];
  }, [availableDays, selectedDate]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.year;
    const month = calendarMonth.month;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { key: string; day: number; isAvailable: boolean; isPast: boolean }[] = [];

    for (let i = 1; i <= daysInMonth; i++) {
      const key = formatCalendarDateKey(year, month, i);
      days.push({
        key,
        day: i,
        isAvailable: availableDateSet.has(key),
        isPast: key < todayKey,
      });
    }

    return { days, firstDayOffset: firstDay };
  }, [calendarMonth, availableDateSet, todayKey]);

  // ── Parse custom questions ───────────────────────────────────

  const customQuestions = useMemo((): CustomQuestion[] => {
    if (!selectedPreset?.custom_questions) return [];
    try {
      if (Array.isArray(selectedPreset.custom_questions)) {
        return selectedPreset.custom_questions as CustomQuestion[];
      }
      if (typeof selectedPreset.custom_questions === 'string') {
        return JSON.parse(selectedPreset.custom_questions) as CustomQuestion[];
      }
      return [];
    } catch {
      return [];
    }
  }, [selectedPreset]);

  // ── Submit handler ───────────────────────────────────────────

  async function handleSubmit() {
    if (!selectedPreset || !selectedSlot) return;

    const missingRequiredQuestion = customQuestions.some(
      (question) => question.required && !String(formData.responses[question.id] || '').trim()
    );

    if (missingRequiredQuestion) {
      setSubmitError('Please complete all required questions.');
      return;
    }

    setStep('submitting');
    setSubmitError(null);

    try {
      const res = await fetch(`/api/resources/${hubSlug}/${resourceSlug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type_id: selectedPreset.id,
          start_at: selectedSlot.start,
          guest_name: formData.name,
          guest_email: formData.email,
          responses: Object.keys(formData.responses).length > 0 ? formData.responses : undefined,
        }),
      });

      if (res.status === 429) {
        setSubmitError('Too many requests. Please try again later.');
        setStep('form');
        return;
      }

      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error?.message || 'Failed to submit request');
        setStep('form');
        return;
      }

      setStep('done');
    } catch {
      setSubmitError('Something went wrong. Please try again.');
      setStep('form');
    }
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/resources/${hubSlug}`}
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to resources
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{asset.name}</h1>
        {asset.description && (
          <p className="mt-1 text-muted-foreground">{asset.description}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <Key className="h-3 w-3" />
            {POLICY_LABELS[asset.approval_policy] || asset.approval_policy}
          </span>
        </div>
      </div>

      {/* Access instructions */}
      {asset.access_instructions && step === 'preset' && (
        <div className="mb-6 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
          <p className="text-sm text-blue-800 dark:text-blue-200">{asset.access_instructions}</p>
        </div>
      )}

      {/* Step: Preset selection */}
      {step === 'preset' && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Select an option</h2>
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => { setSelectedPreset(preset); setStep('date'); }}
              className="flex w-full items-center justify-between rounded-lg border bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900"
            >
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{preset.title}</div>
                {preset.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{preset.description}</p>
                )}
              </div>
              <span className="ml-4 flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {preset.duration_minutes} min
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Step: Date selection */}
      {step === 'date' && selectedPreset && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => {
                if (presets.length > 1) { setStep('preset'); setSelectedPreset(null); }
                else router.push(`/resources/${hubSlug}`);
              }}
              className="text-sm text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100"
            >
              <ArrowLeft className="inline mr-1 h-4 w-4" />
              Back
            </button>
            <span className="text-sm text-muted-foreground">
              {selectedPreset.title} — {selectedPreset.duration_minutes} min
            </span>
          </div>

          <h2 className="mb-4 text-lg font-semibold">Select a date</h2>

          {/* Calendar navigation */}
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => setCalendarMonth((prev) => {
                const d = new Date(prev.year, prev.month - 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })}
              className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="font-medium">
              {new Date(calendarMonth.year, calendarMonth.month).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => setCalendarMonth((prev) => {
                const d = new Date(prev.year, prev.month + 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })}
              className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="rounded-lg border bg-white p-4 dark:bg-gray-900">
            {slotsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <>
                <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: calendarDays.firstDayOffset }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {calendarDays.days.map(({ key, day, isAvailable, isPast }) => (
                    <button
                      key={key}
                      disabled={!isAvailable || isPast}
                      onClick={() => { setSelectedDate(key); setStep('time'); }}
                      className={`aspect-square rounded-lg text-sm font-medium transition-colors ${
                        isAvailable && !isPast
                          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300'
                          : 'text-gray-300 dark:text-gray-700'
                      } ${selectedDate === key ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Step: Time selection */}
      {step === 'time' && selectedDate && (
        <div>
          <div className="mb-4">
            <button
              onClick={() => { setStep('date'); setSelectedSlot(null); }}
              className="text-sm text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100"
            >
              <ArrowLeft className="inline mr-1 h-4 w-4" />
              Back to calendar
            </button>
          </div>
          <h2 className="mb-2 text-lg font-semibold">
            {new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
              timeZone: inviteeTimezone,
            })}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">Select a time</p>
          <p className="mb-4 text-xs text-muted-foreground">Times shown in {displayTimezone}</p>

          {selectedDaySlots.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No available times for this date.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {selectedDaySlots.map((slot) => {
                const time = new Date(slot.start).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: inviteeTimezone,
                });
                return (
                  <button
                    key={slot.start}
                    onClick={() => { setSelectedSlot(slot); setStep('form'); }}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 ${
                      selectedSlot?.start === slot.start ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'bg-white dark:bg-gray-900'
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

      {/* Step: Form */}
      {step === 'form' && selectedSlot && (
        <div>
          <div className="mb-4">
            <button
              onClick={() => setStep('time')}
              className="text-sm text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100"
            >
              <ArrowLeft className="inline mr-1 h-4 w-4" />
              Back to time selection
            </button>
          </div>

          <div className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <p className="text-sm">
              <strong>{selectedPreset?.title}</strong>
              {' — '}
              {new Date(selectedSlot.start).toLocaleString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
                timeZone: inviteeTimezone,
              })}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-900"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-900"
                required
              />
            </div>

            {/* Custom questions */}
            {customQuestions.map((q) => (
              <div key={q.id}>
                <label className="mb-1 block text-sm font-medium">
                  {q.label} {q.required && '*'}
                </label>
                {q.type === 'textarea' ? (
                  <textarea
                    value={formData.responses[q.id] || ''}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      responses: { ...prev.responses, [q.id]: e.target.value },
                    }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-900"
                    rows={3}
                  />
                ) : q.type === 'select' || q.type === 'radio' ? (
                  <select
                    value={formData.responses[q.id] || ''}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      responses: { ...prev.responses, [q.id]: e.target.value },
                    }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-900"
                  >
                    <option value="">Select...</option>
                    {(q.options || []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={q.type === 'email' ? 'email' : q.type === 'phone' ? 'tel' : 'text'}
                    value={formData.responses[q.id] || ''}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      responses: { ...prev.responses, [q.id]: e.target.value },
                    }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-900"
                  />
                )}
              </div>
            ))}

            {submitError && (
              <p className="text-sm text-red-600">{submitError}</p>
            )}

            <button
              onClick={() => void handleSubmit()}
              disabled={!formData.name || !formData.email}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Submit Request
            </button>

            <p className="text-center text-xs text-muted-foreground">
              A verification email will be sent to confirm your request.
            </p>
          </div>
        </div>
      )}

      {/* Step: Submitting */}
      {step === 'submitting' && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Submitting your request...</p>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <div className="rounded-lg border bg-white p-8 text-center dark:bg-gray-900">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Check Your Email</h2>
          <p className="mt-2 text-muted-foreground">
            We&apos;ve sent a verification email to <strong>{formData.email}</strong>.
            Click the link in the email to confirm your request.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            The verification link expires in 30 minutes.
          </p>
        </div>
      )}
    </div>
  );
}
