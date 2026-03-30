import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, getProjectBySlug } from '@/lib/community/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { incidentPersonSchema } from '@/lib/validators/incident';
import { ensureProjectEntity } from '@/lib/community/ops';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

async function resolveContext(slug: string, action: 'view' | 'create') {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const project = await getProjectBySlug(supabase, slug);
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };

  await requireCommunityPermission(supabase, user.id, project.id, 'incidents', action);
  return { supabase, project };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const resolved = await resolveContext(slug, 'view');
    if ('error' in resolved) return resolved.error;

    const incidentExists = await ensureProjectEntity(resolved.supabase as any, 'incidents', id, resolved.project.id, { nullableDeletedAt: false });
    if (!incidentExists) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const { data, error } = await (resolved.supabase as any)
      .from('incident_people')
      .select('*, person:people(id, first_name, last_name, email)')
      .eq('incident_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading incident people:', error);
      return NextResponse.json({ error: 'Failed to load linked people' }, { status: 500 });
    }

    return NextResponse.json({ people: data ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/incidents/[id]/people:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const resolved = await resolveContext(slug, 'create');
    if ('error' in resolved) return resolved.error;

    const incidentExists = await ensureProjectEntity(resolved.supabase as any, 'incidents', id, resolved.project.id, { nullableDeletedAt: false });
    if (!incidentExists) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = incidentPersonSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const exists = await ensureProjectEntity(resolved.supabase as any, 'people', validationResult.data.person_id, resolved.project.id);
    if (!exists) {
      return NextResponse.json({ error: 'person_id not found in this project' }, { status: 400 });
    }

    const { data, error } = await (resolved.supabase as any)
      .from('incident_people')
      .insert({
        incident_id: id,
        ...validationResult.data,
      })
      .select('*, person:people(id, first_name, last_name, email)')
      .single();

    if (error || !data) {
      console.error('Error linking incident person:', error);
      return NextResponse.json({ error: 'Failed to add person to incident' }, { status: 500 });
    }

    return NextResponse.json({ link: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/incidents/[id]/people:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
