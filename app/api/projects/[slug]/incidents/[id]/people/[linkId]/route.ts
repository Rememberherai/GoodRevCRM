import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, getProjectBySlug } from '@/lib/community/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { incidentPersonSchema } from '@/lib/validators/incident';
import { ensureProjectEntity } from '@/lib/community/ops';

interface RouteContext {
  params: Promise<{ slug: string; id: string; linkId: string }>;
}

async function resolveContext(slug: string, action: 'update' | 'delete') {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const project = await getProjectBySlug(supabase, slug);
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };

  await requireCommunityPermission(supabase, user.id, project.id, 'incidents', action);
  return { supabase, project };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id, linkId } = await context.params;
    const resolved = await resolveContext(slug, 'update');
    if ('error' in resolved) return resolved.error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incidentExists = await ensureProjectEntity(resolved.supabase as any, 'incidents', id, resolved.project.id, { nullableDeletedAt: false });
    if (!incidentExists) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = incidentPersonSchema.partial().safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    if (validationResult.data.person_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exists = await ensureProjectEntity(resolved.supabase as any, 'people', validationResult.data.person_id, resolved.project.id);
      if (!exists) {
        return NextResponse.json({ error: 'person_id not found in this project' }, { status: 400 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = resolved.supabase as any;
    const { data: existing } = await supabaseAny
      .from('incident_people')
      .select('id')
      .eq('incident_id', id)
      .eq('id', linkId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Incident person link not found' }, { status: 404 });
    }

    const { data, error } = await supabaseAny
      .from('incident_people')
      .update(validationResult.data)
      .eq('incident_id', id)
      .eq('id', linkId)
      .select('*, person:people(id, first_name, last_name, email)')
      .single();

    if (error || !data) {
      console.error('Error updating incident person:', error);
      return NextResponse.json({ error: 'Failed to update incident person' }, { status: 500 });
    }

    return NextResponse.json({ link: data });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/incidents/[id]/people/[linkId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id, linkId } = await context.params;
    const resolved = await resolveContext(slug, 'delete');
    if ('error' in resolved) return resolved.error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incidentExists = await ensureProjectEntity(resolved.supabase as any, 'incidents', id, resolved.project.id, { nullableDeletedAt: false });
    if (!incidentExists) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = resolved.supabase as any;
    const { data: existing } = await supabaseAny
      .from('incident_people')
      .select('id')
      .eq('incident_id', id)
      .eq('id', linkId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Incident person link not found' }, { status: 404 });
    }

    const { error } = await supabaseAny
      .from('incident_people')
      .delete()
      .eq('incident_id', id)
      .eq('id', linkId);

    if (error) {
      console.error('Error deleting incident person:', error);
      return NextResponse.json({ error: 'Failed to remove person from incident' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/projects/[slug]/incidents/[id]/people/[linkId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
