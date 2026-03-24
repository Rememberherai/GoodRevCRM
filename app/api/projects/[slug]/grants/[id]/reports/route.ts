import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createGrantReportSchema } from '@/lib/validators/community/grant-reports';


interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id: grantId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || project.project_type !== 'community')
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'view');

    const { data, error } = await supabase
      .from('grant_report_schedules')
      .select('*')
      .eq('grant_id', grantId)
      .eq('project_id', project.id)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ reports: data ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/grants/[id]/reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id: grantId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || project.project_type !== 'community')
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'create');

    const body = await request.json();
    const validation = createGrantReportSchema.safeParse({ ...body, grant_id: grantId });
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('grant_report_schedules')
      .insert({
        grant_id: grantId,
        project_id: project.id,
        report_type: validation.data.report_type,
        title: validation.data.title,
        due_date: validation.data.due_date,
        status: validation.data.status,
        document_id: validation.data.document_id ?? null,
        notes: validation.data.notes ?? null,
      })
      .select()
      .single();

    if (error || !data) throw error ?? new Error('Failed to create report schedule');
    return NextResponse.json({ report: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/projects/[slug]/grants/[id]/reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
