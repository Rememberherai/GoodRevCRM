import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createTaskSchema, taskQuerySchema } from '@/lib/validators/task';
import { ensureProjectEntity, ensureProjectUserMembership } from '@/lib/community/ops';
import { canAccessCommunityResource, getProjectMembershipRole } from '@/lib/community/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/tasks - List tasks
export async function GET(request: Request, context: RouteContext) {
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

    const membershipRole = await getProjectMembershipRole(supabase, user.id, project.id);
    if (!membershipRole) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const queryResult = taskQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      priority: searchParams.get('priority') ?? undefined,
      assigned_to: searchParams.get('assigned_to') ?? undefined,
      person_id: searchParams.get('person_id') ?? undefined,
      organization_id: searchParams.get('organization_id') ?? undefined,
      opportunity_id: searchParams.get('opportunity_id') ?? undefined,
      rfp_id: searchParams.get('rfp_id') ?? undefined,
      grant_id: searchParams.get('grant_id') ?? undefined,
      household_id: searchParams.get('household_id') ?? undefined,
      case_id: searchParams.get('case_id') ?? undefined,
      incident_id: searchParams.get('incident_id') ?? undefined,
      due_before: searchParams.get('due_before') ?? undefined,
      due_after: searchParams.get('due_after') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { status, priority, assigned_to, person_id, organization_id, opportunity_id, rfp_id, grant_id, household_id, case_id, incident_id, due_before, due_after, limit, offset } = queryResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    const canViewCases = await canAccessCommunityResource(supabase, user.id, project.id, 'cases', 'view');
    const canViewIncidents = await canAccessCommunityResource(supabase, user.id, project.id, 'incidents', 'view');

    if (case_id && !canViewCases) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (incident_id && !canViewIncidents) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let query = supabaseAny
      .from('tasks')
      .select('*, assigned_user:users!tasks_assigned_to_fkey(id, full_name, email)')
      .eq('project_id', project.id);

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);
    if (person_id) query = query.eq('person_id', person_id);
    if (organization_id) query = query.eq('organization_id', organization_id);
    if (opportunity_id) query = query.eq('opportunity_id', opportunity_id);
    if (rfp_id) query = query.eq('rfp_id', rfp_id);
    if (grant_id) query = query.eq('grant_id', grant_id);
    if (household_id) query = query.eq('household_id', household_id);
    if (case_id) query = query.eq('case_id', case_id);
    if (incident_id) query = query.eq('incident_id', incident_id);
    if (due_before) query = query.lte('due_date', due_before);
    if (due_after) query = query.gte('due_date', due_after);
    if (!case_id && !canViewCases) query = query.is('case_id', null);
    if (!incident_id && !canViewIncidents) query = query.is('incident_id', null);

    const { data: tasks, error } = await query
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('priority', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching tasks:', error);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    return NextResponse.json({
      tasks: tasks ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/tasks - Create task
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

    const membershipRole = await getProjectMembershipRole(supabase, user.id, project.id);
    if (!membershipRole) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = createTaskSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { assigned_to, person_id, organization_id, opportunity_id, rfp_id, grant_id, household_id, case_id, incident_id } = validationResult.data;

    // Validate assigned_to is a project member
    if (assigned_to) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isMember = await ensureProjectUserMembership(supabase as any, assigned_to, project.id);
      if (!isMember) {
        return NextResponse.json(
          { error: 'assigned_to must be a member of this project' },
          { status: 400 }
        );
      }
    }

    // Validate referenced entities belong to the same project and not soft-deleted
    if (person_id) {
      const { data: person } = await supabase
        .from('people')
        .select('id')
        .eq('id', person_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!person) {
        return NextResponse.json({ error: 'person_id not found in this project' }, { status: 400 });
      }
    }
    if (organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', organization_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!org) {
        return NextResponse.json({ error: 'organization_id not found in this project' }, { status: 400 });
      }
    }
    if (opportunity_id) {
      const { data: opp } = await supabase
        .from('opportunities')
        .select('id')
        .eq('id', opportunity_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!opp) {
        return NextResponse.json({ error: 'opportunity_id not found in this project' }, { status: 400 });
      }
    }
    if (rfp_id) {
      const { data: rfpData } = await supabase
        .from('rfps')
        .select('id')
        .eq('id', rfp_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!rfpData) {
        return NextResponse.json({ error: 'rfp_id not found in this project' }, { status: 400 });
      }
    }
    if (grant_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: grantData } = await (supabase as any)
        .from('grants')
        .select('id')
        .eq('id', grant_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!grantData) {
        return NextResponse.json({ error: 'grant_id not found in this project' }, { status: 404 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    if (household_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exists = await ensureProjectEntity(supabase as any, 'households', household_id, project.id);
      if (!exists) {
        return NextResponse.json({ error: 'household_id not found in this project' }, { status: 400 });
      }
    }

    let inferredHouseholdId = household_id ?? null;

    if (case_id) {
      const canCreateCaseTasks = await canAccessCommunityResource(supabase, user.id, project.id, 'cases', 'create');
      if (!canCreateCaseTasks) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const { data: caseRecord } = await supabaseAny
        .from('household_cases')
        .select('id, household_id')
        .eq('project_id', project.id)
        .eq('id', case_id)
        .single();
      if (!caseRecord) {
        return NextResponse.json({ error: 'case_id not found in this project' }, { status: 400 });
      }
      if (inferredHouseholdId && caseRecord.household_id && inferredHouseholdId !== caseRecord.household_id) {
        return NextResponse.json(
          { error: 'household_id must match the household linked to case_id' },
          { status: 400 }
        );
      }
      inferredHouseholdId = inferredHouseholdId ?? caseRecord.household_id;
    }

    if (incident_id) {
      const canCreateIncidentTasks = await canAccessCommunityResource(supabase, user.id, project.id, 'incidents', 'create');
      if (!canCreateIncidentTasks) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const { data: incidentRecord } = await supabaseAny
        .from('incidents')
        .select('id, household_id')
        .eq('project_id', project.id)
        .eq('id', incident_id)
        .single();
      if (!incidentRecord) {
        return NextResponse.json({ error: 'incident_id not found in this project' }, { status: 400 });
      }
      if (inferredHouseholdId && incidentRecord.household_id && inferredHouseholdId !== incidentRecord.household_id) {
        return NextResponse.json(
          { error: 'household_id must match the household linked to incident_id' },
          { status: 400 }
        );
      }
      inferredHouseholdId = inferredHouseholdId ?? incidentRecord.household_id ?? null;
    }

    const { data: task, error } = await supabaseAny
      .from('tasks')
      .insert({
        project_id: project.id,
        ...validationResult.data,
        household_id: inferredHouseholdId,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
