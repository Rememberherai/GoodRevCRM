import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { bulkTagOperationSchema } from '@/lib/validators/bulk';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// POST /api/projects/[slug]/tags/assign - Bulk assign tags
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = bulkTagOperationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { tag_ids, entity_type, entity_ids } = validationResult.data;

    const entityTableMap: Record<string, string> = {
      person: 'people',
      organization: 'organizations',
      opportunity: 'opportunities',
      task: 'tasks',
    };
    const tableName = entityTableMap[entity_type];
    if (!tableName) {
      return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    const uniqueEntityIds = [...new Set(entity_ids)];
    const softDeleteTypes = new Set(['person', 'organization', 'opportunity']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let entityQuery = (supabase as any)
      .from(tableName)
      .select('id')
      .in('id', uniqueEntityIds)
      .eq('project_id', project.id);
    if (softDeleteTypes.has(entity_type)) {
      entityQuery = entityQuery.is('deleted_at', null);
    }
    const { data: validEntities } = await entityQuery;

    if (!validEntities || validEntities.length !== uniqueEntityIds.length) {
      return NextResponse.json({ error: 'Some entity IDs do not belong to this project' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: count, error } = await supabaseAny.rpc('bulk_assign_tags', {
      p_project_id: project.id,
      p_tag_ids: tag_ids,
      p_entity_type: entity_type,
      p_entity_ids: entity_ids,
    });

    if (error) {
      console.error('Error assigning tags:', error);
      return NextResponse.json({ error: 'Failed to assign tags' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      assigned_count: count ?? 0,
    });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/tags/assign:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/tags/assign - Bulk remove tags
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = bulkTagOperationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { tag_ids, entity_type, entity_ids } = validationResult.data;

    const entityTableMap: Record<string, string> = {
      person: 'people',
      organization: 'organizations',
      opportunity: 'opportunities',
      task: 'tasks',
    };
    const tableName = entityTableMap[entity_type];
    if (!tableName) {
      return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    const uniqueEntityIds = [...new Set(entity_ids)];
    const softDeleteTypes = new Set(['person', 'organization', 'opportunity']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let entityQuery = (supabase as any)
      .from(tableName)
      .select('id')
      .in('id', uniqueEntityIds)
      .eq('project_id', project.id);
    if (softDeleteTypes.has(entity_type)) {
      entityQuery = entityQuery.is('deleted_at', null);
    }
    const { data: validEntities } = await entityQuery;

    if (!validEntities || validEntities.length !== uniqueEntityIds.length) {
      return NextResponse.json({ error: 'Some entity IDs do not belong to this project' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: count, error } = await supabaseAny.rpc('bulk_remove_tags', {
      p_project_id: project.id,
      p_tag_ids: tag_ids,
      p_entity_type: entity_type,
      p_entity_ids: entity_ids,
    });

    if (error) {
      console.error('Error removing tags:', error);
      return NextResponse.json({ error: 'Failed to remove tags' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      removed_count: count ?? 0,
    });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/tags/assign:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
