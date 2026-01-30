import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateTagSchema } from '@/lib/validators/bulk';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/tags/[id] - Get single tag
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: tag, error } = await supabaseAny
      .from('entity_tags')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Get assignment count
    const { count } = await supabaseAny
      .from('entity_tag_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', id);

    return NextResponse.json({
      ...tag,
      assignment_count: count ?? 0,
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/tags/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/tags/[id] - Update tag
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

    const body = await request.json();
    const validationResult = updateTagSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: tag, error } = await supabaseAny
      .from('entity_tags')
      .update(validationResult.data)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Tag with this name already exists' }, { status: 409 });
      }
      console.error('Error updating tag:', error);
      return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
    }

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json(tag);
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/tags/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/tags/[id] - Delete tag
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { error } = await supabaseAny
      .from('entity_tags')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id);

    if (error) {
      console.error('Error deleting tag:', error);
      return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/tags/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
