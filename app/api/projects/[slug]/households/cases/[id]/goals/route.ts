import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, getProjectBySlug } from '@/lib/community/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { createCaseGoalSchema } from '@/lib/validators/case';
import { createHouseholdCaseEvent, ensureProjectUserMembership } from '@/lib/community/ops';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

async function resolveContext(slug: string, action: 'view' | 'create') {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const project = await getProjectBySlug(supabase, slug);
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };

  await requireCommunityPermission(supabase, user.id, project.id, 'cases', action);
  return { supabase, user, project };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const resolved = await resolveContext(slug, 'view');
    if ('error' in resolved) return resolved.error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = resolved.supabase as any;
    const { data: caseRecord } = await supabaseAny
      .from('household_cases')
      .select('id')
      .eq('project_id', resolved.project.id)
      .eq('id', id)
      .single();

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const { data, error } = await supabaseAny
      .from('household_case_goals')
      .select('*')
      .eq('case_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading case goals:', error);
      return NextResponse.json({ error: 'Failed to load goals' }, { status: 500 });
    }

    return NextResponse.json({ goals: data ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/households/cases/[id]/goals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const resolved = await resolveContext(slug, 'create');
    if ('error' in resolved) return resolved.error;

    const body = await request.json();
    const validationResult = createCaseGoalSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    if (validationResult.data.owner_user_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isMember = await ensureProjectUserMembership(resolved.supabase as any, validationResult.data.owner_user_id, resolved.project.id);
      if (!isMember) {
        return NextResponse.json({ error: 'owner_user_id must be a member of this project' }, { status: 400 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = resolved.supabase as any;
    const { data: caseRecord } = await supabaseAny
      .from('household_cases')
      .select('id, household_id')
      .eq('project_id', resolved.project.id)
      .eq('id', id)
      .single();

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const { data, error } = await supabaseAny
      .from('household_case_goals')
      .insert({
        ...validationResult.data,
        case_id: id,
      })
      .select('*')
      .single();

    if (error || !data) {
      console.error('Error creating case goal:', error);
      return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
    }

    await createHouseholdCaseEvent(supabaseAny, {
      caseId: id,
      householdId: caseRecord.household_id,
      projectId: resolved.project.id,
      eventType: 'status_changed',
      summary: `Goal created: ${data.title}`,
      createdBy: resolved.user.id,
      metadata: { goal_id: data.id },
    });

    return NextResponse.json({ goal: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/households/cases/[id]/goals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
