'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

export default function CancelBookingPage() {
  const params = useParams();
  const token = params.token as string;

  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'cancelling' | 'success' | 'error' | 'expired'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    setStatus('cancelling');

    try {
      const res = await fetch('/api/book/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason: reason || undefined }),
      });

      if (res.status === 410) {
        setStatus('expired');
        return;
      }

      if (!res.ok) {
        let msg = 'Failed to cancel booking';
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch {
          // Response body may not be JSON
        }
        setErrorMessage(msg);
        setStatus('error');
        return;
      }

      setStatus('success');
    } catch {
      setErrorMessage('An error occurred. Please try again.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-4xl">&#10003;</div>
        <h1 className="text-2xl font-bold">Booking Cancelled</h1>
        <p className="text-muted-foreground">
          Your booking has been successfully cancelled. The host has been notified.
        </p>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="text-center py-12 space-y-4">
        <h1 className="text-2xl font-bold">Link Expired</h1>
        <p className="text-muted-foreground">
          This cancellation link has expired. The meeting may have already started.
          Please contact the host directly.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Cancel Booking</h1>
        <p className="text-muted-foreground mt-2">
          Are you sure you want to cancel this booking?
        </p>
      </div>

      <div className="rounded-lg border bg-white dark:bg-gray-900 p-6 space-y-4">
        <div>
          <label htmlFor="reason" className="block text-sm font-medium mb-1">
            Reason for cancellation (optional)
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent"
            placeholder="Let the host know why you're cancelling..."
          />
        </div>

        {status === 'error' && (
          <p className="text-sm text-red-600">{errorMessage}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={status === 'cancelling'}
            className="flex-1 rounded-lg bg-red-600 text-white py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {status === 'cancelling' ? 'Cancelling...' : 'Cancel Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}
