import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateEnrollmentSchema } from '@/lib/validators/sequence';

interface RouteContext {
  params: Promise<{ slug: string; id: string; enrollmentId: string }>;
}

// GET /api/projects/[slug]/sequences/[id]/enrollments/[enrollmentId] - Get enrollment
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id, enrollmentId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Verify sequence exists
    const { data: sequence } = await supabaseAny
      .from('sequences')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    const { data: enrollment, error } = await supabaseAny
      .from('sequence_enrollments')
      .select(`
        *,
        person:people(id, first_name, last_name, email)
      `)
      .eq('id', enrollmentId)
      .eq('sequence_id', id)
      .single();

    if (error || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    return NextResponse.json(enrollment);
  } catch (error) {
    console.error('Error in GET enrollment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/sequences/[id]/enrollments/[enrollmentId] - Update enrollment
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id, enrollmentId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Verify sequence exists
    const { data: sequence } = await supabaseAny
      .from('sequences')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    // Verify enrollment exists
    const { data: existingEnrollment } = await supabaseAny
      .from('sequence_enrollments')
      .select('id, status')
      .eq('id', enrollmentId)
      .eq('sequence_id', id)
      .single();

    if (!existingEnrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = updateEnrollmentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { data: enrollment, error } = await supabaseAny
      .from('sequence_enrollments')
      .update(validationResult.data)
      .eq('id', enrollmentId)
      .eq('sequence_id', id)
      .select(`
        *,
        person:people(id, first_name, last_name, email)
      `)
      .single();

    if (error) {
      console.error('Error updating enrollment:', error);
      return NextResponse.json({ error: 'Failed to update enrollment' }, { status: 500 });
    }

    return NextResponse.json(enrollment);
  } catch (error) {
    console.error('Error in PATCH enrollment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/sequences/[id]/enrollments/[enrollmentId] - Cancel enrollment
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id, enrollmentId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Verify sequence exists
    const { data: sequence } = await supabaseAny
      .from('sequences')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    // Delete the enrollment
    const { error } = await supabaseAny
      .from('sequence_enrollments')
      .delete()
      .eq('id', enrollmentId)
      .eq('sequence_id', id);

    if (error) {
      console.error('Error deleting enrollment:', error);
      return NextResponse.json({ error: 'Failed to delete enrollment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE enrollment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
