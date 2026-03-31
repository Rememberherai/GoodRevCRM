import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createStepSchema } from '@/lib/validators/sequence';
import { deriveFieldsFromDesign } from '@/lib/email-builder/derive-fields';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/sequences/[id]/steps - List steps
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

    const { data: steps, error } = await supabaseAny
      .from('sequence_steps')
      .select('*')
      .eq('sequence_id', id)
      .order('step_number', { ascending: true });

    if (error) {
      console.error('Error fetching steps:', error);
      return NextResponse.json({ error: 'Failed to fetch steps' }, { status: 500 });
    }

    return NextResponse.json({ steps: steps ?? [] });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/sequences/[id]/steps:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/sequences/[id]/steps - Create step
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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
      .select('id, status')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    if (sequence.status === 'active') {
      return NextResponse.json(
        { error: 'Cannot modify steps while sequence is active. Pause the sequence first.' },
        { status: 409 }
      );
    }

    const body = await request.json();
    const validationResult = createStepSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Get next step number if not provided
    let stepNumber = validationResult.data.step_number;
    if (!stepNumber) {
      const { data: lastStep } = await supabaseAny
        .from('sequence_steps')
        .select('step_number')
        .eq('sequence_id', id)
        .order('step_number', { ascending: false })
        .limit(1)
        .single();

      stepNumber = (lastStep?.step_number ?? 0) + 1;
    } else {
      // If inserting at a specific position, shift all steps at or after this position
      // Use RPC to atomically increment step_number in a single query
      const { error: shiftError } = await supabaseAny.rpc('shift_sequence_steps', {
        p_sequence_id: id,
        p_from_step_number: stepNumber,
      });

      if (shiftError) {
        console.error('Error shifting steps:', shiftError);
        return NextResponse.json({ error: 'Failed to shift existing steps' }, { status: 500 });
      }
    }

    // When design_json is present, derive body_html and body_text server-side
    const deriveResult = deriveFieldsFromDesign(validationResult.data.design_json, 'body_text', { validate: true });
    if (deriveResult.status === 'invalid') {
      return NextResponse.json({ error: deriveResult.error }, { status: 400 });
    }
    const derived = deriveResult.status === 'ok' ? deriveResult.fields : {};

    const { data: step, error } = await supabaseAny
      .from('sequence_steps')
      .insert({
        sequence_id: id,
        ...validationResult.data,
        ...derived,
        step_number: stepNumber,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating step:', error);
      return NextResponse.json({ error: 'Failed to create step' }, { status: 500 });
    }

    return NextResponse.json(step, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/sequences/[id]/steps:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
