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

    // Validate status transitions
    if (validationResult.data.status) {
      const VALID_TRANSITIONS: Record<string, string[]> = {
        active: ['paused', 'completed', 'cancelled', 'not_interested', 'wrong_contact', 'do_not_contact'],
        paused: ['active', 'completed', 'cancelled', 'not_interested', 'wrong_contact', 'do_not_contact'],
      };
      const allowed = VALID_TRANSITIONS[existingEnrollment.status] || [];
      if (!allowed.includes(validationResult.data.status)) {
        return NextResponse.json(
          { error: `Cannot transition from '${existingEnrollment.status}' to '${validationResult.data.status}'` },
          { status: 400 }
        );
      }
    }

    // Validate current_step against actual sequence steps
    if (validationResult.data.current_step !== undefined) {
      const { data: steps } = await supabaseAny
        .from('sequence_steps')
        .select('step_number')
        .eq('sequence_id', id);
      const validStepNumbers = (steps ?? []).map((s: { step_number: number }) => s.step_number);
      if (validStepNumbers.length > 0 && !validStepNumbers.includes(validationResult.data.current_step)) {
        return NextResponse.json(
          { error: `current_step ${validationResult.data.current_step} does not match any step in the sequence (valid: ${validStepNumbers.sort((a: number, b: number) => a - b).join(', ')})` },
          { status: 400 }
        );
      }
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

// DELETE /api/projects/[slug]/sequences/[id]/enrollments/[enrollmentId] - Disposition enrollment
// Body (optional): { disposition?: string, reason?: string }
// disposition: 'cancelled' | 'not_interested' | 'wrong_contact' | 'do_not_contact'
export async function DELETE(request: Request, context: RouteContext) {
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
      .select('id, name, project_id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    // Get enrollment with person info
    const { data: enrollment } = await supabaseAny
      .from('sequence_enrollments')
      .select('id, person_id, status')
      .eq('id', enrollmentId)
      .eq('sequence_id', id)
      .single();

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    // Parse optional body for disposition details
    let disposition = 'cancelled';
    let reason = '';
    try {
      const body = await request.json();
      if (body.disposition) disposition = body.disposition;
      if (body.reason) reason = body.reason;
    } catch {
      // No body or invalid JSON — default to cancelled
    }

    const validDispositions = ['cancelled', 'not_interested', 'wrong_contact', 'do_not_contact'];
    if (!validDispositions.includes(disposition)) {
      disposition = 'cancelled';
    }

    const DISPOSITION_LABELS: Record<string, string> = {
      cancelled: 'Cancelled',
      not_interested: 'Not Interested',
      wrong_contact: 'Wrong Contact',
      do_not_contact: 'Do Not Contact',
    };

    // Update enrollment status instead of deleting
    const { error } = await supabaseAny
      .from('sequence_enrollments')
      .update({
        status: disposition,
        next_send_at: null,
        disposition_reason: reason || null,
        dispositioned_at: new Date().toISOString(),
        dispositioned_by: user.id,
      })
      .eq('id', enrollmentId)
      .eq('sequence_id', id);

    if (error) {
      console.error('Error dispositioning enrollment:', error);
      return NextResponse.json({ error: 'Failed to disposition enrollment' }, { status: 500 });
    }

    // Log activity on the person's timeline
    try {
      await supabaseAny.from('activity_log').insert({
        project_id: project.id,
        user_id: user.id,
        entity_type: 'person',
        entity_id: enrollment.person_id,
        action: 'dispositioned',
        activity_type: 'email',
        outcome: `sequence_${disposition}`,
        direction: 'outbound',
        subject: `Sequence "${sequence.name}" — ${DISPOSITION_LABELS[disposition] ?? disposition}`,
        notes: reason || `Enrollment was dispositioned as "${DISPOSITION_LABELS[disposition] ?? disposition}".`,
        person_id: enrollment.person_id,
        metadata: {
          sequence_id: id,
          sequence_name: sequence.name,
          enrollment_id: enrollmentId,
          disposition,
          reason: reason || null,
        },
      });
    } catch (actErr) {
      console.error('Error logging disposition activity:', actErr);
    }

    return NextResponse.json({ success: true, disposition });
  } catch (error) {
    console.error('Error in DELETE enrollment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
