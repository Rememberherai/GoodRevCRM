import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireWorkflowPermission } from '@/lib/projects/workflow-permissions';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/workflows/[id]/versions
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireWorkflowPermission(supabase, user.id, project, 'view');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Verify workflow belongs to this project
    const { data: workflow } = await supabaseAny
      .from('workflows').select('id')
      .eq('id', id).eq('project_id', project.id).single();
    if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    const { data: versions, error } = await supabaseAny
      .from('workflow_versions')
      .select('id, workflow_id, version, trigger_type, change_summary, created_by, created_at')
      .eq('workflow_id', id)
      .order('version', { ascending: false });

    if (error) {
      console.error('Error fetching versions:', error);
      return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
    }

    return NextResponse.json({ versions: versions ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /workflows/[id]/versions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
