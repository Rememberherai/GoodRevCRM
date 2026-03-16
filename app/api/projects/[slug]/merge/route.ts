import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { performMerge } from '@/lib/deduplication';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const mergeSchema = z.object({
  entity_type: z.enum(['person', 'organization']),
  survivor_id: z.string().uuid(),
  merge_ids: z.array(z.string().uuid()).min(1),
  field_selections: z.record(z.string(), z.string()).optional(),
});

// POST /api/projects/[slug]/merge - Direct merge without duplicate_candidates
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
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
    const validation = mergeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { entity_type, survivor_id, merge_ids, field_selections } = validation.data;

    // Prevent merge-with-self
    if (merge_ids.includes(survivor_id)) {
      return NextResponse.json({ error: 'survivor_id cannot also appear in merge_ids' }, { status: 400 });
    }

    // Verify all records exist in this project
    const table = entity_type === 'person' ? 'people' : 'organizations';
    const allIds = [survivor_id, ...merge_ids];
    const { data: records, error: fetchError } = await supabase
      .from(table)
      .select('id')
      .in('id', allIds)
      .eq('project_id', project.id)
      .is('deleted_at', null);

    if (fetchError || !records || records.length !== allIds.length) {
      return NextResponse.json({ error: 'One or more records not found' }, { status: 404 });
    }

    const result = await performMerge(
      {
        entityType: entity_type,
        survivorId: survivor_id,
        mergeIds: merge_ids,
        fieldSelections: field_selections ?? {},
        projectId: project.id,
        userId: user.id,
      },
      supabase
    );

    // Fetch updated survivor
    const { data: survivor } = await supabase.from(table).select('*').eq('id', survivor_id).single();

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.merged' as any,
      entityType: entity_type as any,
      entityId: survivor_id,
      data: {
        survivor_id,
        merged_ids: merge_ids,
        related_records_moved: result.related_records_moved,
      },
    });

    return NextResponse.json({
      survivor,
      merged_count: merge_ids.length,
      related_records_moved: result.related_records_moved,
    });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/merge:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
