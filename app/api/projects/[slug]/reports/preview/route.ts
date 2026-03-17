import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { previewReportSchema } from '@/lib/validators/custom-report';
import { executeCustomReport, ReportQueryError } from '@/lib/reports/query-engine';

// POST /api/projects/[slug]/reports/preview - Run an ad-hoc report preview (max 100 rows)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify membership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership } = await (supabase as any)
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = previewReportSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid report config', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const result = await executeCustomReport(supabase, validationResult.data as unknown as import('@/lib/reports/types').CustomReportConfig, project.id, {
      preview: true,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ReportQueryError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error running report preview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
