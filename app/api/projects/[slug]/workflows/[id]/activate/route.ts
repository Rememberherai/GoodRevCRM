import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireWorkflowPermission } from '@/lib/projects/workflow-permissions';
import { validateWorkflow, hasErrors } from '@/lib/workflows/validators/validate-workflow';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/workflows/[id]/activate - Toggle active status
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireWorkflowPermission(supabase, user.id, project, 'manage');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: existing } = await supabaseAny
      .from('workflows').select('*')
      .eq('id', id).eq('project_id', project.id).single();
    if (!existing) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    const newActive = !existing.is_active;

    // Validate before activation
    if (newActive) {
      const errors = validateWorkflow(existing.definition);
      if (hasErrors(errors)) {
        return NextResponse.json(
          { error: 'Cannot activate workflow with validation errors', validation_errors: errors.filter(e => e.severity === 'error') },
          { status: 400 }
        );
      }
    }

    const { data: workflow, error } = await supabaseAny
      .from('workflows')
      .update({ is_active: newActive })
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 });
    }

    return NextResponse.json({ workflow });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /workflows/[id]/activate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
