'use client';

import Link from 'next/link';

export function ResourceVerificationResult({
  outcome,
  assetName,
  requestedStartAt,
  cancelToken,
  rescheduleToken,
  icsToken,
}: {
  outcome: 'confirmed' | 'pending_review' | 'slot_taken';
  assetName: string;
  requestedStartAt: string;
  cancelToken?: string | null;
  rescheduleToken?: string | null;
  icsToken?: string | null;
}) {
  const formattedDate = requestedStartAt
    ? new Date(requestedStartAt).toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  if (outcome === 'slot_taken') {
    return (
      <div className="mx-auto max-w-lg rounded-lg border bg-white p-8 text-center shadow-sm dark:bg-gray-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
          <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Time No Longer Available</h2>
        <p className="mt-2 text-muted-foreground">
          The time slot you requested for <strong>{assetName}</strong> was taken while your request was being verified.
          Please go back and select a different time.
        </p>
      </div>
    );
  }

  if (outcome === 'pending_review') {
    return (
      <div className="mx-auto max-w-lg rounded-lg border bg-white p-8 text-center shadow-sm dark:bg-gray-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
          <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Request Submitted</h2>
        <p className="mt-2 text-muted-foreground">
          Your request for <strong>{assetName}</strong> on {formattedDate} is pending review.
          You&apos;ll receive an email once it&apos;s been approved.
        </p>
      </div>
    );
  }

  // confirmed
  return (
    <div className="mx-auto max-w-lg rounded-lg border bg-white p-8 text-center shadow-sm dark:bg-gray-900">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
        <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Confirmed!</h2>
      <p className="mt-2 text-muted-foreground">
        Your reservation for <strong>{assetName}</strong> on {formattedDate} has been confirmed.
      </p>

      {(cancelToken || rescheduleToken || icsToken) && (
        <div className="mt-6 space-y-2">
          {icsToken && (
            <Link
              href={`/api/book/ics?token=${icsToken}`}
              className="block text-sm text-green-600 hover:text-green-800"
            >
              Add to calendar
            </Link>
          )}
          {rescheduleToken && (
            <Link
              href={`/book/reschedule/${rescheduleToken}`}
              className="block text-sm text-blue-600 hover:text-blue-800"
            >
              Reschedule
            </Link>
          )}
          {cancelToken && (
            <Link
              href={`/book/cancel/${cancelToken}`}
              className="block text-sm text-red-600 hover:text-red-800"
            >
              Cancel reservation
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
