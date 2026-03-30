import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, getProjectBySlug } from '@/lib/community/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { createNoteSchema } from '@/lib/validators/note';

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
  return { supabase, user, project };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const resolved = await resolveContext(slug, 'view');
    if ('error' in resolved) return resolved.error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = resolved.supabase as any;
    const { data: incident } = await supabaseAny
      .from('incidents')
      .select('id')
      .eq('project_id', resolved.project.id)
      .eq('id', id)
      .single();

    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const { data, error } = await supabaseAny
      .from('notes')
      .select('*, author:users!notes_created_by_fkey(id, full_name, email, avatar_url)')
      .eq('project_id', resolved.project.id)
      .eq('incident_id', id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading incident notes:', error);
      return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 });
    }

    return NextResponse.json({ notes: data ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/incidents/[id]/notes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const resolved = await resolveContext(slug, 'create');
    if ('error' in resolved) return resolved.error;

    const body = await request.json();
    const validationResult = createNoteSchema.safeParse({
      ...body,
      case_id: null,
      incident_id: id,
    });

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = resolved.supabase as any;
    const { data: incident } = await supabaseAny
      .from('incidents')
      .select('household_id')
      .eq('project_id', resolved.project.id)
      .eq('id', id)
      .single();

    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const { data, error } = await supabaseAny
      .from('notes')
      .insert({
        ...validationResult.data,
        project_id: resolved.project.id,
        household_id: incident.household_id,
        case_id: null,
        incident_id: id,
        created_by: resolved.user.id,
      })
      .select('*, author:users!notes_created_by_fkey(id, full_name, email, avatar_url)')
      .single();

    if (error || !data) {
      console.error('Error creating incident note:', error);
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    return NextResponse.json({ note: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/incidents/[id]/notes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
