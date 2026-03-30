import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, getProjectBySlug } from '@/lib/community/server';
import { requireCommunityPermission, type CommunityAction } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { caseListQuerySchema, createCaseSchema } from '@/lib/validators/case';
import { createHouseholdCaseEvent, ensureProjectEntity, ensureProjectUserMembership } from '@/lib/community/ops';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

async function resolveContext(slug: string, action: CommunityAction) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const project = await getProjectBySlug(supabase, slug);
  if (!project) {
    return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
  }

  const role = await requireCommunityPermission(supabase, user.id, project.id, 'cases', action);
  return { supabase, user, project, role };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const resolved = await resolveContext(slug, 'view');
    if ('error' in resolved) return resolved.error;

    const { searchParams } = new URL(request.url);
    const queryResult = caseListQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      priority: searchParams.get('priority') ?? undefined,
      assigned_to: searchParams.get('assigned_to') ?? undefined,
      overdue: searchParams.get('overdue') ?? undefined,
      household_id: searchParams.get('household_id') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters', details: queryResult.error.flatten() }, { status: 400 });
    }

    const { supabase, project } = resolved;
    const supabaseAny = supabase as any;
    const { status, priority, assigned_to, overdue, household_id, limit, offset } = queryResult.data;

    let query = supabaseAny
      .from('household_cases')
      .select(`
        *,
        household:households(id, name),
        assignee:users!household_cases_assigned_to_fkey(id, full_name, email)
      `, { count: 'exact' })
      .eq('project_id', project.id);

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);
    if (household_id) query = query.eq('household_id', household_id);
    if (overdue) query = query.lt('next_follow_up_at', new Date().toISOString()).neq('status', 'closed');

    const { data, error, count } = await query
      .order('next_follow_up_at', { ascending: true, nullsFirst: false })
      .order('priority', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error listing cases:', error);
      return NextResponse.json({ error: 'Failed to load cases' }, { status: 500 });
    }

    return NextResponse.json({
      cases: data ?? [],
      pagination: { limit, offset, total: count ?? 0 },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/households/cases:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const resolved = await resolveContext(slug, 'create');
    if ('error' in resolved) return resolved.error;

    const { supabase, user, project } = resolved;
    const body = await request.json();
    const validationResult = createCaseSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { household_id, assigned_to } = validationResult.data;
    const householdExists = await ensureProjectEntity(supabase as any, 'households', household_id, project.id);
    if (!householdExists) {
      return NextResponse.json({ error: 'Household not found in this project' }, { status: 400 });
    }

    if (assigned_to) {
      const isMember = await ensureProjectUserMembership(supabase as any, assigned_to, project.id);
      if (!isMember) {
        return NextResponse.json({ error: 'assigned_to must be a member of this project' }, { status: 400 });
      }
    }

    const supabaseAny = supabase as any;
    const { data: existing } = await supabaseAny
      .from('household_cases')
      .select('id')
      .eq('project_id', project.id)
      .eq('household_id', household_id)
      .neq('status', 'closed')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'This household already has an active case' }, { status: 409 });
    }

    const insertPayload = {
      ...validationResult.data,
      project_id: project.id,
      created_by: user.id,
    };

    const { data, error } = await supabaseAny
      .from('household_cases')
      .insert(insertPayload)
      .select(`
        *,
        household:households(id, name),
        assignee:users!household_cases_assigned_to_fkey(id, full_name, email)
      `)
      .single();

    if (error || !data) {
      console.error('Error creating case:', error);
      return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
    }

    await createHouseholdCaseEvent(supabaseAny, {
      caseId: data.id,
      householdId: data.household_id,
      projectId: project.id,
      eventType: 'opened',
      summary: 'Case opened',
      createdBy: user.id,
    });

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'case.created' as never,
      entityType: 'case' as never,
      entityId: data.id,
      data: data as Record<string, unknown>,
    });

    return NextResponse.json({ case: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/households/cases:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
