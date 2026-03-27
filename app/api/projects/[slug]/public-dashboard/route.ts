import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createDashboardConfigSchema } from '@/lib/validators/community/public-dashboard';
import { getPublicDashboardAggregateData, serializePublicDashboardPreviewData } from '@/lib/community/public-dashboard-queries';
import { hashPublicDashboardPassword } from '@/lib/community/public-dashboard-auth';
import type { Database, Json } from '@/types/database';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

type PublicDashboardInsert = Database['public']['Tables']['public_dashboard_configs']['Insert'];

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'public_dashboard', 'manage');

    const { data, error } = await supabase.from('public_dashboard_configs').select('*').eq('project_id', project.id).order('updated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ configs: data ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/public-dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'public_dashboard', 'manage');

    const body = await request.json();
    const validation = createDashboardConfigSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const password_hash = validation.data.password ? hashPublicDashboardPassword(validation.data.password) : null;

    // Only compute aggregate data for snapshot dashboards — live dashboards fetch on demand
    let snapshot_data: Json | null = null;
    if (validation.data.data_freshness === 'snapshot') {
      const configForQuery: Parameters<typeof getPublicDashboardAggregateData>[0] = {
        access_type: validation.data.access_type,
        archived_at: validation.data.archived_at ?? null,
        created_at: new Date().toISOString(),
        data_freshness: validation.data.data_freshness,
        date_range_end: validation.data.date_range_end ?? null,
        date_range_start: validation.data.date_range_start ?? null,
        date_range_type: validation.data.date_range_type,
        description: validation.data.description ?? null,
        excluded_categories: validation.data.excluded_categories,
        geo_granularity: validation.data.geo_granularity,
        hero_image_url: validation.data.hero_image_url ?? null,
        id: crypto.randomUUID(),
        min_count_threshold: validation.data.min_count_threshold,
        password_hash,
        project_id: project.id,
        published_at: validation.data.published_at ?? null,
        published_by: user.id,
        slug: validation.data.slug,
        snapshot_data: null,
        status: validation.data.status,
        theme: validation.data.theme as unknown as Json,
        title: validation.data.title,
        updated_at: new Date().toISOString(),
        widget_order: validation.data.widget_order,
        widgets: validation.data.widgets as unknown as Json,
      };
      const aggregateData = await getPublicDashboardAggregateData(configForQuery);
      snapshot_data = serializePublicDashboardPreviewData(aggregateData);
    }

    const insertData: PublicDashboardInsert = {
      ...validation.data,
      theme: validation.data.theme as unknown as Json,
      widgets: validation.data.widgets as unknown as Json,
      password_hash,
      project_id: project.id,
      published_by: validation.data.status === 'published' ? user.id : null,
      snapshot_data,
    };

    const { data, error } = await supabase
      .from('public_dashboard_configs')
      .insert(insertData)
      .select()
      .single();

    if (error || !data) throw error ?? new Error('Failed to create public dashboard config');
    return NextResponse.json({ config: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/projects/[slug]/public-dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
