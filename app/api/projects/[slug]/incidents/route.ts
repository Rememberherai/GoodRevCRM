import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, getProjectBySlug } from '@/lib/community/server';
import { requireCommunityPermission, type CommunityAction } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { incidentListQuerySchema, createIncidentSchema } from '@/lib/validators/incident';
import { ensureProjectEntity, ensureProjectUserMembership, normalizeIncidentVisibility } from '@/lib/community/ops';
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

  const role = await requireCommunityPermission(supabase, user.id, project.id, 'incidents', action);
  return { supabase, user, project, role };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const resolved = await resolveContext(slug, 'view');
    if ('error' in resolved) return resolved.error;

    const { searchParams } = new URL(request.url);
    const queryResult = incidentListQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      severity: searchParams.get('severity') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      assigned_to: searchParams.get('assigned_to') ?? undefined,
      household_id: searchParams.get('household_id') ?? undefined,
      event_id: searchParams.get('event_id') ?? undefined,
      asset_id: searchParams.get('asset_id') ?? undefined,
      overdue: searchParams.get('overdue') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters', details: queryResult.error.flatten() }, { status: 400 });
    }

    const { supabase, project } = resolved;
    const supabaseAny = supabase as any;
    const { status, severity, category, assigned_to, household_id, event_id, asset_id, overdue, limit, offset } = queryResult.data;

    let query = supabaseAny
      .from('incidents')
      .select(`
        *,
        household:households(id, name),
        assignee:users!incidents_assigned_to_fkey(id, full_name, email)
      `, { count: 'exact' })
      .eq('project_id', project.id);

    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);
    if (category) query = query.eq('category', category);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);
    if (household_id) query = query.eq('household_id', household_id);
    if (event_id) query = query.eq('event_id', event_id);
    if (asset_id) query = query.eq('asset_id', asset_id);
    if (overdue) query = query.lt('follow_up_due_at', new Date().toISOString()).not('status', 'in', '(resolved,closed)');

    const { data, error, count } = await query
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error loading incidents:', error);
      return NextResponse.json({ error: 'Failed to load incidents' }, { status: 500 });
    }

    return NextResponse.json({
      incidents: data ?? [],
      pagination: { limit, offset, total: count ?? 0 },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/incidents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const resolved = await resolveContext(slug, 'create');
    if ('error' in resolved) return resolved.error;

    const body = await request.json();
    const validationResult = createIncidentSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const supabase = resolved.supabase as any;
    const payload = { ...validationResult.data };

    if (payload.assigned_to) {
      const isMember = await ensureProjectUserMembership(supabase, payload.assigned_to, resolved.project.id);
      if (!isMember) {
        return NextResponse.json({ error: 'assigned_to must be a member of this project' }, { status: 400 });
      }
    }

    if (payload.household_id) {
      const exists = await ensureProjectEntity(supabase, 'households', payload.household_id, resolved.project.id);
      if (!exists) {
        return NextResponse.json({ error: 'household_id not found in this project' }, { status: 400 });
      }
    }

    if (payload.event_id) {
      const exists = await ensureProjectEntity(supabase, 'events', payload.event_id, resolved.project.id, { nullableDeletedAt: false });
      if (!exists) {
        return NextResponse.json({ error: 'event_id not found in this project' }, { status: 400 });
      }
    }

    if (payload.asset_id) {
      const exists = await ensureProjectEntity(supabase, 'community_assets', payload.asset_id, resolved.project.id, { nullableDeletedAt: false });
      if (!exists) {
        return NextResponse.json({ error: 'asset_id not found in this project' }, { status: 400 });
      }
    }

    payload.visibility = normalizeIncidentVisibility(payload.visibility, resolved.role, 'create');

    const { data, error } = await supabase
      .from('incidents')
      .insert({
        ...payload,
        project_id: resolved.project.id,
        reported_by: resolved.user.id,
      })
      .select(`
        *,
        household:households(id, name),
        assignee:users!incidents_assigned_to_fkey(id, full_name, email)
      `)
      .single();

    if (error || !data) {
      console.error('Error creating incident:', error);
      return NextResponse.json({ error: 'Failed to create incident' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: resolved.project.id,
      triggerType: 'incident.created' as never,
      entityType: 'incident' as never,
      entityId: data.id,
      data: data as Record<string, unknown>,
    });

    return NextResponse.json({ incident: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/incidents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
