import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeTimeEntryDurationMinutes } from '@/lib/community/jobs';
import { z } from 'zod';
import type { Json } from '@/types/database';

interface RouteContext {
  params: Promise<{ slug: string; entryId: string }>;
}

const selfCorrectionSchema = z.object({
  started_at: z.string().optional(),
  ended_at: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

async function resolveEmployeePerson(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, projectId: string) {
  const { data } = await supabase
    .from('people')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .eq('is_employee', true)
    .maybeSingle();
  return data;
}

async function verifyMembership(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, projectId: string) {
  const { data } = await supabase
    .from('project_memberships')
    .select('role')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .maybeSingle();
  return data;
}

// PATCH /api/employee/[slug]/entries/[entryId] — self-correction (own entries, same day only)
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, entryId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') return NextResponse.json({ error: 'Not a community project' }, { status: 400 });

    const membership = await verifyMembership(supabase, user.id, project.id);
    if (!membership) return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });

    const person = await resolveEmployeePerson(supabase, user.id, project.id);
    if (!person) return NextResponse.json({ error: 'No employee profile linked to your account in this project' }, { status: 403 });

    // Fetch entry — must belong to this person
    const { data: entry } = await supabase
      .from('job_time_entries')
      .select('*')
      .eq('id', entryId)
      .maybeSingle();

    if (!entry) return NextResponse.json({ error: 'Time entry not found' }, { status: 404 });

    // Own-record enforcement — no admin bypass
    if (entry.person_id !== person.id && entry.contractor_id !== person.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (entry.job_id) {
      return NextResponse.json({ error: 'Only standalone punch entries can be self-corrected' }, { status: 403 });
    }

    // Reject corrections older than 24 hours (measured from the most recent relevant timestamp)
    const latestTimestamp = entry.ended_at
      ? Math.max(Date.parse(entry.started_at), Date.parse(entry.ended_at))
      : Date.parse(entry.started_at);
    const entryAge = Date.now() - latestTimestamp;
    if (entryAge > 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Entries older than 24 hours cannot be self-corrected. Contact your admin.' }, { status: 403 });
    }

    const body = await request.json() as Record<string, unknown>;
    const validation = selfCorrectionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const startedAt = validation.data.started_at ?? entry.started_at;
    const endedAt = validation.data.ended_at === undefined ? entry.ended_at : validation.data.ended_at;

    // Disallow re-opening a completed entry by nulling ended_at
    if (entry.ended_at !== null && endedAt === null) {
      return NextResponse.json({ error: 'Cannot re-open a completed entry. Contact your admin.' }, { status: 403 });
    }

    if (endedAt && Date.parse(endedAt) <= Date.parse(startedAt)) {
      return NextResponse.json({ error: 'ended_at must be after started_at' }, { status: 400 });
    }

    const notes = validation.data.notes === undefined ? entry.notes : (validation.data.notes ?? null);

    const adminClient = createAdminClient();
    const { data: updatedEntry, error } = await adminClient
      .from('job_time_entries')
      .update({
        started_at: startedAt,
        ended_at: endedAt,
        duration_minutes: computeTimeEntryDurationMinutes(startedAt, endedAt ?? null),
        notes,
      })
      .eq('id', entryId)
      .select('*')
      .single();

    if (error || !updatedEntry) {
      return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 });
    }

    // Write audit row
    try {
      await adminClient.from('time_entry_audit').insert({
        time_entry_id: entryId,
        project_id: project.id,
        person_id: person.id,
        action: 'update',
        changed_by: user.id,
        changed_by_role: 'employee_self',
        entry_source: entry.entry_source,
        old_data: entry as unknown as Json,
        new_data: updatedEntry as unknown as Json,
      });
    } catch (auditErr) {
      console.error('Failed to write time_entry_audit row:', auditErr);
    }

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    console.error('Error in PATCH /api/employee/[slug]/entries/[entryId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
