import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { updateGrantReportSchema } from '@/lib/validators/community/grant-reports';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string; reportId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id: grantId, reportId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'view');

    const { data, error } = await supabase
      .from('grant_report_schedules')
      .select('*')
      .eq('id', reportId)
      .eq('grant_id', grantId)
      .eq('project_id', project.id)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    return NextResponse.json({ report: data });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id: grantId, reportId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'update');

    // Fetch existing to detect status transitions
    const { data: existing } = await supabase
      .from('grant_report_schedules')
      .select('status')
      .eq('id', reportId)
      .eq('grant_id', grantId)
      .eq('project_id', project.id)
      .single();

    if (!existing) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    const body = await request.json();
    const validation = updateGrantReportSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    // Auto-set submitted_at when status changes to submitted
    const updates = { ...validation.data };
    if (updates.status === 'submitted' && existing.status !== 'submitted' && !updates.submitted_at) {
      updates.submitted_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('grant_report_schedules')
      .update(updates)
      .eq('id', reportId)
      .eq('grant_id', grantId)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

    // Emit report submitted event
    if (updates.status === 'submitted' && existing.status !== 'submitted') {
      emitAutomationEvent({
        projectId: project.id,
        triggerType: 'grant.report_submitted' as never,
        entityType: 'grant' as never,
        entityId: grantId,
        data: { report: data as unknown as Record<string, unknown>, grant_id: grantId },
      });
    }

    return NextResponse.json({ report: data });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in PATCH report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id: grantId, reportId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'delete');

    const { error } = await supabase
      .from('grant_report_schedules')
      .delete()
      .eq('id', reportId)
      .eq('grant_id', grantId)
      .eq('project_id', project.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in DELETE report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
