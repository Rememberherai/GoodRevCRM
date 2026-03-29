import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireWorkflowPermission } from '@/lib/projects/workflow-permissions';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/workflows/[id]/duplicate
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireWorkflowPermission(supabase, user.id, project, 'create');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: original } = await supabaseAny
      .from('workflows').select('*')
      .eq('id', id).eq('project_id', project.id).single();
    if (!original) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    const { data: workflow, error } = await supabaseAny
      .from('workflows')
      .insert({
        project_id: project.id,
        name: `${original.name} (copy)`,
        description: original.description,
        is_active: false,
        is_template: false,
        trigger_type: original.trigger_type,
        trigger_config: original.trigger_config,
        definition: original.definition,
        tags: original.tags,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error duplicating workflow:', error);
      return NextResponse.json({ error: 'Failed to duplicate workflow' }, { status: 500 });
    }

    // Create initial version for the copy
    await supabaseAny.from('workflow_versions').insert({
      workflow_id: workflow.id,
      version: 1,
      definition: workflow.definition,
      trigger_type: workflow.trigger_type,
      trigger_config: workflow.trigger_config,
      change_summary: `Duplicated from "${original.name}"`,
      created_by: user.id,
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /workflows/[id]/duplicate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
