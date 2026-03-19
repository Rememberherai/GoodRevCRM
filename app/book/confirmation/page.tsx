'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ConfirmationContent() {
  const searchParams = useSearchParams();

  const name = searchParams.get('name') || '';
  const email = searchParams.get('email') || '';
  const start = searchParams.get('start') || '';
  const duration = parseInt(searchParams.get('duration') || '30');
  const title = searchParams.get('title') || 'Meeting';
  const host = searchParams.get('host') || '';
  const icsToken = searchParams.get('ics_token');
  const inviteeTimezone = searchParams.get('invitee_timezone')
    || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const rescheduled = searchParams.get('rescheduled') === 'true';

  const startDate = start ? new Date(start) : null;
  const endDate = startDate ? new Date(startDate.getTime() + duration * 60 * 1000) : null;

  // Google Calendar link
  const googleCalUrl = startDate && endDate
    ? (() => {
        const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        const params = new URLSearchParams({
          action: 'TEMPLATE',
          text: title,
          dates: `${fmt(startDate)}/${fmt(endDate)}`,
          details: `Meeting with ${host}`,
        });
        return `https://calendar.google.com/calendar/render?${params}`;
      })()
    : null;

  return (
    <div className="text-center space-y-8 py-8">
      <div className="space-y-3">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto text-green-600 dark:text-green-400 text-2xl">
          &#10003;
        </div>
        <h1 className="text-2xl font-bold">
          {rescheduled ? 'Meeting Rescheduled' : 'Meeting Scheduled'}
        </h1>
        <p className="text-muted-foreground">
          {rescheduled
            ? 'Your meeting has been rescheduled. Updated details are below.'
            : 'A confirmation email has been sent to your inbox.'}
        </p>
      </div>

      <div className="rounded-lg border bg-white dark:bg-gray-900 p-6 text-left space-y-4 max-w-md mx-auto">
        <div>
          <p className="text-sm text-muted-foreground">What</p>
          <p className="font-medium">{title}</p>
        </div>

        {host && (
          <div>
            <p className="text-sm text-muted-foreground">With</p>
            <p className="font-medium">{host}</p>
          </div>
        )}

        {startDate && (
          <div>
            <p className="text-sm text-muted-foreground">When</p>
            <p className="font-medium">
              {startDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                timeZone: inviteeTimezone,
              })}
            </p>
            <p className="text-sm">
              {startDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                timeZone: inviteeTimezone,
              })}
              {' - '}
              {endDate?.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                timeZone: inviteeTimezone,
              })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {inviteeTimezone}
            </p>
          </div>
        )}

        {name && (
          <div>
            <p className="text-sm text-muted-foreground">Invitee</p>
            <p className="font-medium">{name}</p>
            {email && <p className="text-sm text-muted-foreground">{email}</p>}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {icsToken && (
          <a
            href={`/api/book/ics?token=${icsToken}`}
            download
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Download .ics
          </a>
        )}

        {googleCalUrl && (
          <a
            href={googleCalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Add to Google Calendar
          </a>
        )}
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
