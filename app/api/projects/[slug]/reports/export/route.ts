import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { previewReportSchema } from '@/lib/validators/custom-report';
import { executeCustomReport, ReportQueryError } from '@/lib/reports/query-engine';
import { rowsToCsv } from '@/lib/reports/csv-export';
import type { CustomReportConfig, ReportAggregation } from '@/lib/reports/types';

function buildHeaderLabels(aggregations?: ReportAggregation[]): Record<string, string> {
  const labels: Record<string, string> = {};
  if (!aggregations) return labels;

  for (const agg of aggregations) {
    const fieldLabel = agg.fieldName.replace(/_/g, ' ');
    switch (agg.function) {
      case 'sum': labels[agg.alias] = `Total ${fieldLabel}`; break;
      case 'avg': labels[agg.alias] = `Avg ${fieldLabel}`; break;
      case 'count': labels[agg.alias] = agg.fieldName === 'id' ? 'Record Count' : `Count of ${fieldLabel}`; break;
      case 'min': labels[agg.alias] = `Min ${fieldLabel}`; break;
      case 'max': labels[agg.alias] = `Max ${fieldLabel}`; break;
      case 'count_distinct': labels[agg.alias] = `Unique ${fieldLabel}`; break;
    }
  }
  return labels;
}

// POST /api/projects/[slug]/reports/export - Export report as CSV
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

    let config: CustomReportConfig;
    let reportName = 'report';

    if (body.report_id) {
      // Load saved report config
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: report, error: reportError } = await (supabase as any)
        .from('report_definitions')
        .select('name, config')
        .eq('id', body.report_id)
        .eq('project_id', project.id)
        .single();

      if (reportError || !report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }
      config = report.config as CustomReportConfig;
      reportName = (report.name as string) || 'report';
    } else {
      // Use inline config
      const validationResult = previewReportSchema.safeParse(body.config ?? body);
      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Invalid report config', details: validationResult.error.flatten() },
          { status: 400 }
        );
      }
      config = validationResult.data as unknown as CustomReportConfig;
    }

    const result = await executeCustomReport(supabase, config, project.id);

    const headerLabels = buildHeaderLabels(config.aggregations);
    const csv = rowsToCsv(result.columns, result.rows, headerLabels);

    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = reportName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}-${dateStr}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof ReportQueryError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error exporting report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
