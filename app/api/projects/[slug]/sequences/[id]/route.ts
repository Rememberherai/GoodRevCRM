import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateSequenceSchema } from '@/lib/validators/sequence';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/sequences/[id] - Get sequence details
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

    const { data: sequence, error } = await supabaseAny
      .from('sequences')
      .select(`
        *,
        steps:sequence_steps(*),
        enrollments:sequence_enrollments(count)
      `)
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    // Sort steps by step_number
    if (sequence.steps) {
      sequence.steps.sort((a: { step_number: number }, b: { step_number: number }) =>
        a.step_number - b.step_number
      );
    }

    return NextResponse.json(sequence);
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/sequences/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/sequences/[id] - Update sequence
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
    const validationResult = updateSequenceSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: sequence, error } = await supabaseAny
      .from('sequences')
      .update({
        ...validationResult.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error || !sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    return NextResponse.json(sequence);
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/sequences/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/sequences/[id] - Delete sequence
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

    // Check for active enrollments before allowing deletion
    const { count: activeEnrollments } = await supabaseAny
      .from('sequence_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('sequence_id', id)
      .eq('status', 'active');

    if (activeEnrollments && activeEnrollments > 0) {
      return NextResponse.json(
        { error: 'Cannot delete sequence with active enrollments. Cancel or complete all enrollments first.' },
        { status: 409 }
      );
    }

    const { error } = await supabaseAny
      .from('sequences')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id);

    if (error) {
      console.error('Error deleting sequence:', error);
      return NextResponse.json({ error: 'Failed to delete sequence' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/sequences/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
