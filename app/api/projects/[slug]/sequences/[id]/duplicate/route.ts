import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/sequences/[id]/duplicate - Duplicate a sequence with all steps
export async function POST(_request: Request, context: RouteContext) {
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

    // Fetch the original sequence with its steps
    const { data: original, error: fetchError } = await supabaseAny
      .from('sequences')
      .select(`
        *,
        steps:sequence_steps(*)
      `)
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (fetchError || !original) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    // Create the duplicated sequence (always starts as draft)
    const { data: newSequence, error: createError } = await supabaseAny
      .from('sequences')
      .insert({
        project_id: project.id,
        name: `${original.name} (Copy)`,
        description: original.description,
        settings: original.settings,
        organization_id: original.organization_id,
        person_id: original.person_id,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single();

    if (createError || !newSequence) {
      console.error('Error creating duplicated sequence:', createError);
      return NextResponse.json({ error: 'Failed to duplicate sequence' }, { status: 500 });
    }

    // Duplicate all steps if any exist
    if (original.steps && original.steps.length > 0) {
      const stepsToInsert = original.steps.map((step: {
        step_number: number;
        step_type: string;
        delay_days: number;
        delay_hours: number;
        subject: string | null;
        body_template: string | null;
        settings: Record<string, unknown> | null;
      }) => ({
        sequence_id: newSequence.id,
        step_number: step.step_number,
        step_type: step.step_type,
        delay_days: step.delay_days,
        delay_hours: step.delay_hours,
        subject: step.subject,
        body_template: step.body_template,
        settings: step.settings,
      }));

      const { error: stepsError } = await supabaseAny
        .from('sequence_steps')
        .insert(stepsToInsert);

      if (stepsError) {
        console.error('Error duplicating steps:', stepsError);
        // Rollback: delete the sequence we just created
        await supabaseAny.from('sequences').delete().eq('id', newSequence.id);
        return NextResponse.json({ error: 'Failed to duplicate sequence steps' }, { status: 500 });
      }
    }

    // Fetch the complete new sequence with steps to return
    const { data: completeSequence } = await supabaseAny
      .from('sequences')
      .select(`
        *,
        steps:sequence_steps(count),
        enrollments:sequence_enrollments(count)
      `)
      .eq('id', newSequence.id)
      .single();

    return NextResponse.json(completeSequence ?? newSequence, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/sequences/[id]/duplicate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
