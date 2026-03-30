import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateNoteSchema } from '@/lib/validators/note';
import { canAccessCommunityResource, getProjectMembershipRole } from '@/lib/community/server';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

async function getNoteRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  noteId: string
) {
  const { data, error } = await supabase
    .from('notes')
    .select('*, author:users!notes_created_by_fkey(id, full_name, email, avatar_url)')
    .eq('id', noteId)
    .eq('project_id', projectId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

// GET /api/projects/[slug]/notes/[id] - Get single note
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const note = await getNoteRecord(supabaseAny, project.id, id);
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (note.case_id) {
      const canViewCases = await canAccessCommunityResource(supabase, user.id, project.id, 'cases', 'view');
      if (!canViewCases) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    if (note.incident_id) {
      const canViewIncidents = await canAccessCommunityResource(supabase, user.id, project.id, 'incidents', 'view');
      if (!canViewIncidents) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    return NextResponse.json(note);
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/notes/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/notes/[id] - Update note
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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
    const validationResult = updateNoteSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const existing = await getNoteRecord(supabaseAny, project.id, id);
    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (existing.case_id) {
      const canUpdateCases = await canAccessCommunityResource(supabase, user.id, project.id, 'cases', 'update');
      if (!canUpdateCases) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else if (existing.incident_id) {
      const canUpdateIncidents = await canAccessCommunityResource(supabase, user.id, project.id, 'incidents', 'update');
      if (!canUpdateIncidents) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else if (existing.created_by !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: note, error } = await supabaseAny
      .from('notes')
      .update({
        ...validationResult.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('project_id', project.id)
      .select('*, author:users!notes_created_by_fkey(id, full_name, email, avatar_url)')
      .single();

    if (error) {
      console.error('Error updating note:', error);
      return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
    }

    return NextResponse.json(note);
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/notes/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/notes/[id] - Delete note
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const existing = await getNoteRecord(supabaseAny, project.id, id);
    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (existing.case_id) {
      const canDeleteCases = await canAccessCommunityResource(supabase, user.id, project.id, 'cases', 'delete');
      if (!canDeleteCases) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else if (existing.incident_id) {
      const canDeleteIncidents = await canAccessCommunityResource(supabase, user.id, project.id, 'incidents', 'delete');
      if (!canDeleteIncidents) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else if (existing.created_by !== user.id && !['owner', 'admin'].includes(membershipRole)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { error } = await supabaseAny
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id);

    if (error) {
      console.error('Error deleting note:', error);
      return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/notes/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
