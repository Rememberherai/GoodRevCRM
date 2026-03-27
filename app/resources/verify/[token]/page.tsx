'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ResourceVerificationResult } from '@/components/resources/resource-verification-result';

interface VerificationInfo {
  asset_name: string;
  preset_name: string;
  duration_minutes: number;
  requested_start_at: string;
  requested_end_at: string;
  expires_at: string;
  status: string;
}

interface VerifyOutcome {
  outcome: 'confirmed' | 'pending_review' | 'slot_taken';
  booking_id?: string;
  cancel_token?: string;
  reschedule_token?: string;
  ics_token?: string;
  error?: { message: string };
}

export default function VerificationPage() {
  const params = useParams();
  const token = params.token as string;
  const [info, setInfo] = useState<VerificationInfo | null>(null);
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load verification info on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/resources/verify/${token}`);
        if (res.status === 410) {
          setError('This verification link has expired. Please submit a new request.');
          return;
        }
        if (!res.ok) {
          setError('Invalid verification link');
          return;
        }
        const json = await res.json() as VerificationInfo;
        setInfo(json);

        // If already verified, auto-confirm
        if (json.status === 'verified') {
          await confirmRequest();
        }
      } catch {
        setError('Failed to load verification');
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function confirmRequest() {
    setConfirming(true);
    try {
      const res = await fetch(`/api/resources/verify/${token}`, { method: 'POST' });
      if (res.status === 410) {
        setError('This verification link has expired. Please submit a new request.');
        return;
      }
      const json = await res.json() as VerifyOutcome;
      if (json.error) {
        setError(json.error.message || 'Verification failed');
        return;
      }
      setOutcome(json);
    } catch {
      setError('Failed to confirm request');
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Verification</h1>
        <p className="mt-4 text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (outcome) {
    return (
      <ResourceVerificationResult
        outcome={outcome.outcome}
        assetName={info?.asset_name || 'Resource'}
        requestedStartAt={info?.requested_start_at || ''}
        cancelToken={outcome.cancel_token}
        rescheduleToken={outcome.reschedule_token}
        icsToken={outcome.ics_token}
      />
    );
  }

  if (!info) return null;

  const startDate = new Date(info.requested_start_at);
  const formattedDate = startDate.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-lg border bg-white p-8 shadow-sm dark:bg-gray-900">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Confirm Your Request</h1>
        <p className="mt-2 text-muted-foreground">
          Please confirm your request to proceed.
        </p>

        <div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Resource</dt>
              <dd className="text-gray-900 dark:text-gray-100">{info.asset_name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Type</dt>
              <dd className="text-gray-900 dark:text-gray-100">{info.preset_name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">When</dt>
              <dd className="text-gray-900 dark:text-gray-100">{formattedDate}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Duration</dt>
              <dd className="text-gray-900 dark:text-gray-100">{info.duration_minutes} minutes</dd>
            </div>
          </dl>
        </div>

        <button
          onClick={() => void confirmRequest()}
          disabled={confirming}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {confirming ? 'Confirming...' : 'Confirm Request'}
        </button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          This link expires at {new Date(info.expires_at).toLocaleTimeString()}.
        </p>
      </div>
    </div>
  );
}
