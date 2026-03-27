import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeTimeEntryDurationMinutes } from '@/lib/community/jobs';
import type { Json } from '@/types/database';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

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

async function writeAudit(params: {
  timeEntryId: string;
  projectId: string;
  personId: string;
  action: 'insert' | 'update';
  changedBy: string;
  entryData: Json;
  oldData?: Json | null;
}) {
  try {
    const adminClient = createAdminClient();
    await adminClient.from('time_entry_audit').insert({
      time_entry_id: params.timeEntryId,
      project_id: params.projectId,
      person_id: params.personId,
      action: params.action,
      changed_by: params.changedBy,
      changed_by_role: 'employee_self',
      entry_source: 'portal',
      old_data: params.oldData ?? null,
      new_data: params.entryData,
    });
  } catch (err) {
    console.error('Failed to write time_entry_audit row:', err);
  }
}

// POST /api/employee/[slug]/punch — clock in or out
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
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

    // Must be a project member
    const membership = await verifyMembership(supabase, user.id, project.id);
    if (!membership) return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });

    // Must have is_employee = true — no admin bypass
    const person = await resolveEmployeePerson(supabase, user.id, project.id);
    if (!person) return NextResponse.json({ error: 'No employee profile linked to your account in this project' }, { status: 403 });

    const adminClient = createAdminClient();

    // Check for open time entry
    const { data: openEntry } = await adminClient
      .from('job_time_entries')
      .select('*')
      .eq('person_id', person.id)
      .is('ended_at', null)
      .is('job_id', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = new Date().toISOString();

    if (openEntry) {
      // Clock out: close the open entry
      const { data: closedEntry, error } = await adminClient
        .from('job_time_entries')
        .update({ ended_at: now, duration_minutes: computeTimeEntryDurationMinutes(openEntry.started_at, now) })
        .eq('id', openEntry.id)
        .select('*')
        .single();

      if (error || !closedEntry) {
        return NextResponse.json({ error: 'Failed to clock out' }, { status: 500 });
      }

      await writeAudit({
        timeEntryId: closedEntry.id,
        projectId: project.id,
        personId: person.id,
        action: 'update',
        changedBy: user.id,
        entryData: closedEntry as unknown as Json,
        oldData: openEntry as unknown as Json,
      });

      return NextResponse.json({ action: 'out', entry: closedEntry });
    } else {
      // Clock in: create new entry — dual-write contractor_id and person_id
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
          entry_source: 'portal',
        })
        .select('*')
        .single();

      if (error || !newEntry) {
        return NextResponse.json({ error: 'Failed to clock in' }, { status: 500 });
      }

      await writeAudit({
        timeEntryId: newEntry.id,
        projectId: project.id,
        personId: person.id,
        action: 'insert',
        changedBy: user.id,
        entryData: newEntry as unknown as Json,
      });

      return NextResponse.json({ action: 'in', entry: newEntry }, { status: 201 });
    }
  } catch (error) {
    console.error('Error in POST /api/employee/[slug]/punch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/employee/[slug]/punch — fetch own entries
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
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

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') ?? '100', 10)));

    // Own entries only — enforced server-side
    let query = supabase
      .from('job_time_entries')
      .select('*, jobs(id, title)')
      .eq('person_id', person.id)
      .is('job_id', null)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (from) query = query.gte('started_at', from);
    if (to) query = query.lte('started_at', `${to}T23:59:59.999Z`);

    const { data: entries, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to load entries' }, { status: 500 });
    }

    // Also return the currently open entry if any
    const openEntry = (entries ?? []).find((e) => !e.ended_at);

    return NextResponse.json({ entries: entries ?? [], open_entry: openEntry ?? null });
  } catch (error) {
    console.error('Error in GET /api/employee/[slug]/punch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
