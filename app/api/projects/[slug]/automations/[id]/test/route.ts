import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { testAutomationSchema } from '@/lib/validators/automation';
import { dryRunAutomation } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/automations/[id]/test - Dry-run automation
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

    // Verify automation belongs to this project
    const { data: automation } = await supabaseAny
      .from('automations')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = testAutomationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { entity_type, entity_id } = validationResult.data;

    const result = await dryRunAutomation(id, entity_type, entity_id, project.id);

    return NextResponse.json({
      test: true,
      ...result,
    });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/automations/[id]/test:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
