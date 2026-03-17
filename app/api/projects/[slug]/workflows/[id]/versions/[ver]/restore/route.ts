import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { validateWorkflow } from '@/lib/workflows/validators/validate-workflow';

interface RouteContext {
  params: Promise<{ slug: string; id: string; ver: string }>;
}

// POST /api/projects/[slug]/workflows/[id]/versions/[ver]/restore
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug, id, ver } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: membership } = await supabaseAny
      .from('project_memberships').select('role')
      .eq('project_id', project.id).eq('user_id', user.id).single();
    if (!membership || !['owner', 'admin', 'member'].includes(membership.role)) {
      return NextResponse.json({ error: 'Member role required' }, { status: 403 });
    }

    // Validate version number parameter
    const versionNum = parseInt(ver, 10);
    if (isNaN(versionNum) || versionNum < 1) {
      return NextResponse.json({ error: 'Invalid version number' }, { status: 400 });
    }

    // Verify workflow belongs to this project first
    const { data: existing } = await supabaseAny
      .from('workflows').select('current_version, is_active')
      .eq('id', id).eq('project_id', project.id).single();
    if (!existing) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    // Get the version to restore
    const { data: version } = await supabaseAny
      .from('workflow_versions').select('*')
      .eq('workflow_id', id).eq('version', versionNum).single();
    if (!version) return NextResponse.json({ error: 'Version not found' }, { status: 404 });

    // Validate restored definition if workflow is active
    if (existing.is_active && version.definition) {
      const errors = validateWorkflow(version.definition);
      const blockers = errors.filter((e: { severity: string }) => e.severity === 'error');
      if (blockers.length > 0) {
        return NextResponse.json(
          { error: 'Cannot restore: definition has validation errors', validation_errors: blockers },
          { status: 400 }
        );
      }
    }

    const newVersion = existing.current_version + 1;

    // Update workflow with restored definition
    const { data: workflow, error } = await supabaseAny
      .from('workflows')
      .update({
        definition: version.definition,
        trigger_type: version.trigger_type,
        trigger_config: version.trigger_config,
        current_version: newVersion,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to restore version' }, { status: 500 });
    }

    // Create new version record
    await supabaseAny.from('workflow_versions').insert({
      workflow_id: id,
      version: newVersion,
      definition: version.definition,
      trigger_type: version.trigger_type,
      trigger_config: version.trigger_config,
      change_summary: `Restored from version ${ver}`,
      created_by: user.id,
    });

    return NextResponse.json({ workflow });
  } catch (error) {
    console.error('Error in POST /workflows/[id]/versions/[ver]/restore:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
