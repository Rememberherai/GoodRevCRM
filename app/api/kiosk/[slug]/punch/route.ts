import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeTimeEntryDurationMinutes } from '@/lib/community/jobs';
import type { Json } from '@/types/database';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

function computePinHmac(projectId: string, pin: string): string {
  const secret = process.env.KIOSK_PIN_SECRET;
  if (!secret) {
    throw new Error('KIOSK_PIN_SECRET environment variable is not set');
  }
  return createHmac('sha256', secret).update(`${projectId}:${pin}`).digest('hex');
}

// In-memory rate limiter for failed PIN attempts (per IP)
const FAILED_PIN_WINDOW_MS = 5 * 60_000; // 5 minutes
const MAX_FAILED_PIN_ATTEMPTS = 5;

interface FailedPinEntry {
  count: number;
  resetAt: number;
}

const failedPinStore = new Map<string, FailedPinEntry>();

// Periodic cleanup to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of failedPinStore) {
    if (entry.resetAt <= now) {
      failedPinStore.delete(key);
    }
  }
}, 60_000).unref();

function recordFailedPinAttempt(ip: string): { blocked: boolean } {
  const now = Date.now();
  const entry = failedPinStore.get(ip);

  if (!entry || entry.resetAt <= now) {
    failedPinStore.set(ip, { count: 1, resetAt: now + FAILED_PIN_WINDOW_MS });
    return { blocked: false };
  }

  entry.count++;
  return { blocked: entry.count > MAX_FAILED_PIN_ATTEMPTS };
}

function isIpBlocked(ip: string): boolean {
  const now = Date.now();
  const entry = failedPinStore.get(ip);
  if (!entry || entry.resetAt <= now) return false;
  return entry.count >= MAX_FAILED_PIN_ATTEMPTS;
}

function clearFailedAttempts(ip: string): void {
  failedPinStore.delete(ip);
}

// POST /api/kiosk/[slug]/punch — public PIN-based clock in/out, no auth required
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const adminClient = createAdminClient();

    const { data: project } = await adminClient
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') return NextResponse.json({ error: 'Not a community project' }, { status: 400 });

    // Brute-force protection: block IPs with too many failed PIN attempts
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown';

    if (isIpBlocked(clientIp)) {
      return NextResponse.json({ error: 'Too many failed attempts. Try again later.' }, { status: 429 });
    }

    const body = await request.json() as Record<string, unknown>;
    const pin = typeof body.pin === 'string' ? body.pin.trim() : null;

    if (!pin || !/^\d{4}$/.test(pin)) {
      recordFailedPinAttempt(clientIp);
      return NextResponse.json({ error: 'PIN not recognized' }, { status: 401 });
    }

    // O(1) HMAC lookup — no raw PIN stored or compared
    const pinHmac = computePinHmac(project.id, pin);

    const { data: person } = await adminClient
      .from('people')
      .select('id, first_name')
      .eq('project_id', project.id)
      .eq('kiosk_pin_hmac', pinHmac)
      .eq('is_employee', true)
      .maybeSingle();

    if (!person) {
      // Same error for wrong PIN or no PIN set — no hints
      recordFailedPinAttempt(clientIp);
      return NextResponse.json({ error: 'PIN not recognized' }, { status: 401 });
    }

    // Successful PIN match — clear failed attempts for this IP
    clearFailedAttempts(clientIp);

    // Rate limit: reject if same person punched within last 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recentPunch } = await adminClient
      .from('kiosk_punches')
      .select('id')
      .eq('person_id', person.id)
      .gte('punched_at', sixtySecondsAgo)
      .limit(1)
      .maybeSingle();

    if (recentPunch) {
      return NextResponse.json({ error: 'Please wait before punching again' }, { status: 429 });
    }

    const now = new Date().toISOString();

    // Check for open entry
    const { data: openEntry } = await adminClient
      .from('job_time_entries')
      .select('*')
      .eq('person_id', person.id)
      .is('ended_at', null)
      .is('job_id', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const ipAddress = clientIp !== 'unknown' ? clientIp : null;

    let timeEntryId: string;
    let action: 'in' | 'out';
    let durationMinutes: number | null = null;

    if (openEntry) {
      // Clock out
      action = 'out';
      durationMinutes = computeTimeEntryDurationMinutes(openEntry.started_at, now);

      const { data: closedEntry, error } = await adminClient
        .from('job_time_entries')
        .update({ ended_at: now, duration_minutes: durationMinutes })
        .eq('id', openEntry.id)
        .select('id')
        .single();

      if (error || !closedEntry) {
        return NextResponse.json({ error: 'Failed to clock out' }, { status: 500 });
      }
      timeEntryId = closedEntry.id;

      // Audit
      try {
        await adminClient.from('time_entry_audit').insert({
          time_entry_id: timeEntryId,
          project_id: project.id,
          person_id: person.id,
          action: 'update',
          changed_by: null,
          changed_by_role: 'kiosk',
          entry_source: 'kiosk',
          old_data: openEntry as unknown as Json,
          new_data: { ...openEntry, ended_at: now, duration_minutes: durationMinutes } as unknown as Json,
        });
      } catch (auditErr) {
        console.error('Kiosk audit write failed:', auditErr);
      }
    } else {
      // Clock in — dual-write contractor_id and person_id
      action = 'in';
      const { data: newEntry, error } = await adminClient
        .from('job_time_entries')
        .insert({
          contractor_id: person.id, // dual-write
          person_id: person.id,     // dual-write
          job_id: null,
          started_at: now,
          ended_at: null,
          is_break: false,
          duration_minutes: null,
          entry_source: 'kiosk',
        })
        .select('id')
        .single();

      if (error || !newEntry) {
        return NextResponse.json({ error: 'Failed to clock in' }, { status: 500 });
      }
      timeEntryId = newEntry.id;

      // Audit
      try {
        await adminClient.from('time_entry_audit').insert({
          time_entry_id: timeEntryId,
          project_id: project.id,
          person_id: person.id,
          action: 'insert',
          changed_by: null,
          changed_by_role: 'kiosk',
          entry_source: 'kiosk',
          new_data: { person_id: person.id, started_at: now, entry_source: 'kiosk' },
        });
      } catch (auditErr) {
        console.error('Kiosk audit write failed:', auditErr);
      }
    }

    // Log kiosk punch
    try {
      await adminClient.from('kiosk_punches').insert({
        project_id: project.id,
        person_id: person.id,
        action,
        punched_at: now,
        ip_address: ipAddress,
        time_entry_id: timeEntryId,
      });
    } catch (punchErr) {
      console.error('Kiosk punch log write failed:', punchErr);
    }

    return NextResponse.json({
      action,
      first_name: person.first_name,
      punched_at: now,
      duration_minutes: durationMinutes,
    });
  } catch (error) {
    console.error('Error in POST /api/kiosk/[slug]/punch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
