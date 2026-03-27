import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requestListQuerySchema } from '@/lib/validators/asset-access';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project || project.project_type !== 'community') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const role = await requireCommunityPermission(supabase, user.id, project.id, 'asset_access', 'view');

    const { searchParams } = new URL(request.url);
    const queryValidation = requestListQuerySchema.safeParse({
      status: searchParams.get('status') || undefined,
      asset_id: searchParams.get('asset_id') || undefined,
      approver_scope: searchParams.get('approver_scope') || undefined,
      cursor: searchParams.get('cursor') || undefined,
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: queryValidation.error.flatten() },
        { status: 400 }
      );
    }

    const { status, asset_id, approver_scope, cursor } = queryValidation.data;
    const overdue = searchParams.get('overdue') === 'true';
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);

    let scopedAssetIds: string[] | null = null;
    if (role === 'staff' || approver_scope === 'mine') {
      const { data: scopedAssets, error: scopedError } = await supabase
        .from('community_asset_approvers')
        .select('asset_id')
        .eq('project_id', project.id)
        .eq('user_id', user.id);

      if (scopedError) throw scopedError;

      scopedAssetIds = (scopedAssets ?? []).map((row) => row.asset_id);

      if (scopedAssetIds.length === 0) {
        return NextResponse.json({ requests: [], nextCursor: undefined, total: 0 });
      }
    }

    let assetIds: string[] | null = null;
    if (asset_id) {
      const { data: asset } = await supabase
        .from('community_assets')
        .select('id')
        .eq('id', asset_id)
        .eq('project_id', project.id)
        .maybeSingle();

      if (!asset) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }

      if (scopedAssetIds && !scopedAssetIds.includes(asset_id)) {
        return NextResponse.json({ requests: [], nextCursor: undefined, total: 0 });
      }

      assetIds = [asset_id];
    } else if (scopedAssetIds) {
      assetIds = scopedAssetIds;
    }

    if (overdue) {
      let assetQuery = supabase
        .from('community_assets')
        .select('id')
        .eq('project_id', project.id)
        .eq('return_required', true)
        .in('access_mode', ['loanable', 'hybrid']);

      if (assetIds) {
        assetQuery = assetQuery.in('id', assetIds);
      }

      const { data: overdueAssets, error: overdueAssetsError } = await assetQuery;
      if (overdueAssetsError) throw overdueAssetsError;

      assetIds = (overdueAssets ?? []).map((asset) => asset.id);
      if (assetIds.length === 0) {
        return NextResponse.json({ requests: [], nextCursor: undefined, total: 0 });
      }
    }

    let eventTypesQuery = supabase
      .from('event_types')
      .select('id')
      .eq('project_id', project.id)
      .not('asset_id', 'is', null);

    if (assetIds) {
      eventTypesQuery = eventTypesQuery.in('asset_id', assetIds);
    }

    const { data: eventTypes, error: eventTypesError } = await eventTypesQuery;
    if (eventTypesError) throw eventTypesError;

    const eventTypeIds = (eventTypes ?? []).map((eventType) => eventType.id);
    if (eventTypeIds.length === 0) {
      return NextResponse.json({ requests: [], nextCursor: undefined, total: 0 });
    }

    let query = supabase
      .from('bookings')
      .select(`
        id, status, start_at, end_at, invitee_name, invitee_email,
        invitee_timezone, invitee_notes, created_at,
        event_types!inner(id, title, asset_id, duration_minutes,
          community_assets(id, name, access_mode, return_required))
      `, { count: 'exact' })
      .eq('project_id', project.id)
      .in('event_type_id', eventTypeIds);

    if (overdue) {
      query = query
        .eq('status', 'confirmed')
        .lt('end_at', new Date().toISOString());
    } else if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    query = query.limit(limit + 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const requests = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? requests[requests.length - 1]?.created_at : undefined;

    return NextResponse.json({ requests, nextCursor, total: count });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/community-assets/requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
