import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { performMerge } from '@/lib/deduplication';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

const resolveSchema = z.object({
  action: z.enum(['allow', 'merge']),
  survivor_id: z.string().uuid().optional(),
  field_selections: z.record(z.string(), z.string()).optional(),
});

// POST /api/projects/[slug]/duplicates/[id]/resolve
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id: candidateId } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const validation = resolveSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    // Fetch the candidate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: candidate, error: fetchError } = await (supabase as any)
      .from('duplicate_candidates')
      .select('*')
      .eq('id', candidateId)
      .eq('project_id', project.id)
      .single();

    if (fetchError || !candidate) {
      return NextResponse.json({ error: 'Duplicate candidate not found' }, { status: 404 });
    }

    if (candidate.status !== 'pending') {
      return NextResponse.json({ error: 'Candidate already resolved' }, { status: 400 });
    }

    const { action, survivor_id, field_selections } = validation.data;

    // Optimistic concurrency: atomically claim this candidate by setting status to 'allowed',
    // only if it's still 'pending'. Prevents double-resolve race condition.
    // For merge actions, we set 'allowed' first as a lock, then update to 'merged' after
    // the merge RPC succeeds. If merge fails, we rollback to 'pending'.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: claimed, error: claimError } = await (supabase as any)
      .from('duplicate_candidates')
      .update({
        status: 'allowed',
        status_changed_at: new Date().toISOString(),
        status_changed_by: user.id,
      })
      .eq('id', candidateId)
      .eq('status', 'pending')
      .select('id')
      .single();

    if (claimError || !claimed) {
      return NextResponse.json({ error: 'Candidate already resolved by another user' }, { status: 409 });
    }

    if (action === 'allow') {
      return NextResponse.json({ success: true, status: 'allowed' });
    }

    // Merge action — validate survivor_id is part of the duplicate pair
    const survivorId = survivor_id ?? candidate.target_id;
    if (survivorId !== candidate.source_id && survivorId !== candidate.target_id) {
      // Rollback claim
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('duplicate_candidates')
        .update({ status: 'pending', status_changed_at: null, status_changed_by: null })
        .eq('id', candidateId);
      return NextResponse.json({ error: 'survivor_id must be one of the duplicate pair records' }, { status: 400 });
    }
    const mergeId = survivorId === candidate.source_id ? candidate.target_id : candidate.source_id;

    let result;
    try {
      result = await performMerge(
        {
          entityType: candidate.entity_type as 'person' | 'organization',
          survivorId,
          mergeIds: [mergeId],
          fieldSelections: field_selections ?? {},
          projectId: project.id,
          userId: user.id,
        },
        supabase
      );
    } catch (mergeError) {
      // Merge failed — rollback candidate status to 'pending' so it can be retried
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('duplicate_candidates')
        .update({ status: 'pending', status_changed_at: null, status_changed_by: null })
        .eq('id', candidateId);
      console.error('Merge RPC failed, rolled back candidate status:', mergeError);
      return NextResponse.json({ error: 'Merge operation failed' }, { status: 500 });
    }

    // Merge succeeded — finalize status to 'merged'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('duplicate_candidates')
      .update({ status: 'merged', status_changed_at: new Date().toISOString() })
      .eq('id', candidateId);

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.merged' as any,
      entityType: candidate.entity_type as any,
      entityId: survivorId,
      data: {
        survivor_id: survivorId,
        merged_ids: [mergeId],
        related_records_moved: result.related_records_moved,
      },
    });

    return NextResponse.json({
      success: true,
      status: 'merged',
      survivor_id: survivorId,
      related_records_moved: result.related_records_moved,
    });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/duplicates/[id]/resolve:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
