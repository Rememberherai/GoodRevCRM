import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/queue/cancel
 * Cancels (dispositions) pending queue enrollments — single, multiple, or all.
 *
 * Body: { ids?: string[], all?: boolean, disposition?: string, reason?: string }
 * - ids: specific enrollment IDs to cancel
 * - all: if true, cancels ALL pending (active + due) enrollments
 * - disposition: 'cancelled' | 'not_interested' | 'wrong_contact' | 'do_not_contact' (default: 'cancelled')
 * - reason: optional text reason
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { ids?: string[]; all?: boolean; disposition?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { ids, all, reason } = body;
  let disposition = body.disposition || 'cancelled';

  const validDispositions = ['cancelled', 'not_interested', 'wrong_contact', 'do_not_contact'];
  if (!validDispositions.includes(disposition)) {
    disposition = 'cancelled';
  }

  if (!all && (!ids || !Array.isArray(ids) || ids.length === 0)) {
    return NextResponse.json(
      { error: 'Provide ids array or set all: true' },
      { status: 400 }
    );
  }

  // Resolve the user's project memberships to scope cancellations
  const { data: userProjects } = await supabase
    .from('project_memberships')
    .select('project_id')
    .eq('user_id', user.id);

  if (!userProjects || userProjects.length === 0) {
    return NextResponse.json({ error: 'No project access' }, { status: 403 });
  }

  const userProjectIds = userProjects.map((p: { project_id: string }) => p.project_id);

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;

  const DISPOSITION_LABELS: Record<string, string> = {
    cancelled: 'Cancelled',
    not_interested: 'Not Interested',
    wrong_contact: 'Wrong Contact',
    do_not_contact: 'Do Not Contact',
  };

  const now = new Date().toISOString();

  // First, fetch the enrollments we're about to cancel (for activity logging)
  // Fetch sequences that belong to the user's projects for scoping
  const { data: userSequences } = await adminAny
    .from('sequences')
    .select('id')
    .in('project_id', userProjectIds);

  const userSequenceIds = (userSequences || []).map((s: { id: string }) => s.id);

  if (userSequenceIds.length === 0) {
    return NextResponse.json({ cancelled: 0 });
  }

  let query = adminAny
    .from('sequence_enrollments')
    .select('id, person_id, sequence_id, sequence:sequences(id, name, project_id)')
    .eq('status', 'active')
    .in('sequence_id', userSequenceIds);

  if (!all && ids) {
    // Explicit ID selection — don't filter by next_send_at
    query = query.in('id', ids);
  } else {
    // Bulk "cancel all" — cancel due items and those with null next_send_at
    query = query.or(`next_send_at.lte.${now},next_send_at.is.null`);
  }

  const { data: enrollments, error: fetchError } = await query;

  if (fetchError) {
    console.error('Error fetching enrollments to cancel:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 });
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ cancelled: 0 });
  }

  // Bulk update all matching enrollments
  const enrollmentIds = enrollments.map((e: { id: string }) => e.id);

  const { error: updateError } = await adminAny
    .from('sequence_enrollments')
    .update({
      status: disposition,
      next_send_at: null,
      disposition_reason: reason || null,
      dispositioned_at: now,
      dispositioned_by: user.id,
    })
    .in('id', enrollmentIds);

  if (updateError) {
    console.error('Error cancelling enrollments:', updateError);
    return NextResponse.json({ error: 'Failed to cancel enrollments' }, { status: 500 });
  }

  // Log activity for each cancelled enrollment (fire-and-forget)
  try {
    const activityRows = enrollments.map((e: {
      id: string;
      person_id: string;
      sequence_id: string;
      sequence?: { id: string; name: string; project_id: string };
    }) => ({
      project_id: e.sequence?.project_id,
      user_id: user.id,
      entity_type: 'person',
      entity_id: e.person_id,
      action: 'dispositioned',
      activity_type: 'email',
      outcome: `sequence_${disposition}`,
      direction: 'outbound',
      subject: `Sequence "${e.sequence?.name ?? 'Unknown'}" — ${DISPOSITION_LABELS[disposition] ?? disposition}`,
      notes: reason || `Enrollment was dispositioned as "${DISPOSITION_LABELS[disposition] ?? disposition}".`,
      person_id: e.person_id,
      metadata: {
        sequence_id: e.sequence_id,
        sequence_name: e.sequence?.name ?? null,
        enrollment_id: e.id,
        disposition,
        reason: reason || null,
        bulk: true,
      },
    }));

    await adminAny.from('activity_log').insert(activityRows);
  } catch (actErr) {
    console.error('Error logging disposition activities:', actErr);
  }

  return NextResponse.json({ cancelled: enrollmentIds.length });
}
