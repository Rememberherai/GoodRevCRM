import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateStepSchema } from '@/lib/validators/sequence';

interface RouteContext {
  params: Promise<{ slug: string; id: string; stepId: string }>;
}

// GET /api/projects/[slug]/sequences/[id]/steps/[stepId] - Get single step
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id, stepId } = await context.params;
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

    // Verify sequence exists and belongs to project
    const { data: sequence } = await supabaseAny
      .from('sequences')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    const { data: step, error } = await supabaseAny
      .from('sequence_steps')
      .select('*')
      .eq('id', stepId)
      .eq('sequence_id', id)
      .single();

    if (error || !step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    return NextResponse.json(step);
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/sequences/[id]/steps/[stepId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/sequences/[id]/steps/[stepId] - Update step
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id, stepId } = await context.params;
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

    // Verify sequence exists and belongs to project
    const { data: sequence } = await supabaseAny
      .from('sequences')
      .select('id, status')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    // Verify step exists
    const { data: existingStep } = await supabaseAny
      .from('sequence_steps')
      .select('id')
      .eq('id', stepId)
      .eq('sequence_id', id)
      .single();

    if (!existingStep) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = updateStepSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { data: step, error } = await supabaseAny
      .from('sequence_steps')
      .update(validationResult.data)
      .eq('id', stepId)
      .eq('sequence_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating step:', error);
      return NextResponse.json({ error: 'Failed to update step' }, { status: 500 });
    }

    return NextResponse.json(step);
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/sequences/[id]/steps/[stepId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/sequences/[id]/steps/[stepId] - Delete step
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id, stepId } = await context.params;
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

    // Verify sequence exists and belongs to project
    const { data: sequence } = await supabaseAny
      .from('sequences')
      .select('id, status')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    // Get the step to know its step_number
    const { data: stepToDelete } = await supabaseAny
      .from('sequence_steps')
      .select('id, step_number')
      .eq('id', stepId)
      .eq('sequence_id', id)
      .single();

    if (!stepToDelete) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    // Delete the step
    const { error: deleteError } = await supabaseAny
      .from('sequence_steps')
      .delete()
      .eq('id', stepId)
      .eq('sequence_id', id);

    if (deleteError) {
      console.error('Error deleting step:', deleteError);
      return NextResponse.json({ error: 'Failed to delete step' }, { status: 500 });
    }

    // Renumber remaining steps to fill the gap
    const { data: remainingSteps } = await supabaseAny
      .from('sequence_steps')
      .select('id, step_number')
      .eq('sequence_id', id)
      .gt('step_number', stepToDelete.step_number)
      .order('step_number', { ascending: true });

    if (remainingSteps && remainingSteps.length > 0) {
      // Update each step's number
      for (const step of remainingSteps) {
        await supabaseAny
          .from('sequence_steps')
          .update({ step_number: step.step_number - 1 })
          .eq('id', step.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/sequences/[id]/steps/[stepId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
