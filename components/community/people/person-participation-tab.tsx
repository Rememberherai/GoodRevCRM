'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, BookOpen, HandHeart } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ProgramEnrollment {
  id: string;
  status: string;
  enrolled_at: string | null;
  completed_at: string | null;
  session_count: number;
  total_hours: number;
  program: {
    id: string;
    name: string;
    description: string | null;
  };
}

interface EventRegistration {
  id: string;
  status: string;
  checked_in_at: string | null;
  created_at: string;
  event: {
    id: string;
    title: string;
    starts_at: string | null;
    ends_at: string | null;
    venue_name: string | null;
  };
}

interface Referral {
  id: string;
  service_type: string;
  status: string;
  outcome: string | null;
  created_at: string;
  partner: { id: string; name: string } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString();
}

function enrollmentStatusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'active': return 'default';
    case 'completed': return 'secondary';
    case 'withdrawn': return 'destructive';
    default: return 'outline';
  }
}

function referralStatusVariant(status: string): 'default' | 'secondary' | 'outline' {
  return status === 'completed' ? 'default' : 'secondary';
}

function eventStatusVariant(status: string): 'default' | 'secondary' | 'outline' {
  return status === 'confirmed' ? 'default' : 'secondary';
}

// ── Section skeletons ─────────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PersonParticipationTab({ personId }: { personId: string }) {
  const { slug } = useParams<{ slug: string }>();

  const [enrollments, setEnrollments] = useState<ProgramEnrollment[]>([]);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);

  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingReferrals, setLoadingReferrals] = useState(true);

  const [errorPrograms, setErrorPrograms] = useState<string | null>(null);
  const [errorEvents, setErrorEvents] = useState<string | null>(null);
  const [errorReferrals, setErrorReferrals] = useState<string | null>(null);

  const fetchPrograms = useCallback(async () => {
    setLoadingPrograms(true);
    setErrorPrograms(null);
    try {
      const res = await fetch(`/api/projects/${slug}/people/${personId}/programs`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to load programs');
      setEnrollments(data.enrollments ?? []);
    } catch (err) {
      setErrorPrograms(err instanceof Error ? err.message : 'Failed to load programs');
    } finally {
      setLoadingPrograms(false);
    }
  }, [slug, personId]);

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    setErrorEvents(null);
    try {
      const res = await fetch(`/api/projects/${slug}/people/${personId}/events`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to load events');
      setRegistrations(data.registrations ?? []);
    } catch (err) {
      setErrorEvents(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoadingEvents(false);
    }
  }, [slug, personId]);

  const fetchReferrals = useCallback(async () => {
    setLoadingReferrals(true);
    setErrorReferrals(null);
    try {
      const res = await fetch(`/api/projects/${slug}/people/${personId}/referrals`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to load services');
      setReferrals(data.referrals ?? []);
    } catch (err) {
      setErrorReferrals(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setLoadingReferrals(false);
    }
  }, [slug, personId]);

  useEffect(() => {
    void fetchPrograms();
    void fetchEvents();
    void fetchReferrals();
  }, [fetchPrograms, fetchEvents, fetchReferrals]);

  return (
    <div className="space-y-6">
      {/* ── Programs ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Programs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPrograms ? (
            <SectionSkeleton />
          ) : errorPrograms ? (
            <p className="text-sm text-destructive">{errorPrograms}</p>
          ) : enrollments.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Not enrolled in any programs.
            </div>
          ) : (
            <ul className="space-y-3">
              {enrollments.map((enrollment) => (
                <li key={enrollment.id} className="flex items-start justify-between rounded-md border p-3">
                  <div className="space-y-1">
                    <Link
                      href={`/projects/${slug}/programs/${enrollment.program.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {enrollment.program.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {enrollment.enrolled_at ? `Enrolled ${formatDate(enrollment.enrolled_at)}` : 'Enrollment date unknown'}
                      {enrollment.completed_at ? ` · Completed ${formatDate(enrollment.completed_at)}` : ''}
                    </p>
                    {(enrollment.session_count > 0 || enrollment.total_hours > 0) && (
                      <p className="text-xs text-muted-foreground">
                        {enrollment.session_count} session{enrollment.session_count !== 1 ? 's' : ''}
                        {enrollment.total_hours > 0 ? ` · ${Math.round(enrollment.total_hours * 100) / 100} hr${enrollment.total_hours !== 1 ? 's' : ''}` : ''}
                      </p>
                    )}
                  </div>
                  <Badge variant={enrollmentStatusVariant(enrollment.status)} className="ml-4 shrink-0 text-xs capitalize">
                    {enrollment.status.replace(/_/g, ' ')}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Events ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEvents ? (
            <SectionSkeleton />
          ) : errorEvents ? (
            <p className="text-sm text-destructive">{errorEvents}</p>
          ) : registrations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No event registrations found.
            </div>
          ) : (
            <ul className="space-y-3">
              {registrations.map((reg) => (
                <li key={reg.id} className="flex items-start justify-between rounded-md border p-3">
                  <div className="space-y-1">
                    <Link
                      href={`/projects/${slug}/events/${reg.event.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {reg.event.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {reg.event.starts_at ? formatDate(reg.event.starts_at) : 'Date TBD'}
                      {reg.event.venue_name ? ` · ${reg.event.venue_name}` : ''}
                    </p>
                    {reg.checked_in_at && (
                      <p className="text-xs text-muted-foreground">
                        Checked in {formatDate(reg.checked_in_at)}
                      </p>
                    )}
                  </div>
                  <Badge variant={eventStatusVariant(reg.status)} className="ml-4 shrink-0 text-xs capitalize">
                    {reg.status.replace(/_/g, ' ')}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Services / Referrals ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HandHeart className="h-5 w-5" />
            Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingReferrals ? (
            <SectionSkeleton />
          ) : errorReferrals ? (
            <p className="text-sm text-destructive">{errorReferrals}</p>
          ) : referrals.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No service referrals on record.
            </div>
          ) : (
            <ul className="space-y-3">
              {referrals.map((referral) => (
                <li key={referral.id} className="flex items-start justify-between rounded-md border p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{referral.service_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(referral.created_at)}
                      {referral.partner ? ` · ${referral.partner.name}` : ''}
                    </p>
                    {referral.outcome && (
                      <p className="text-xs text-muted-foreground">
                        Outcome: {referral.outcome}
                      </p>
                    )}
                  </div>
                  <Badge variant={referralStatusVariant(referral.status)} className="ml-4 shrink-0 text-xs capitalize">
                    {referral.status.replace(/_/g, ' ')}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
