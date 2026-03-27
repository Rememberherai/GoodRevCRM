/**
 * Public hub listing API — resolves hubSlug to project, returns hub config + listed assets
 * with current loans and popularity rankings. No auth required.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ hubSlug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { hubSlug } = await context.params;
    const supabase = createServiceClient();

    // Resolve hub slug to project
    const { data: hub, error: hubError } = await supabase
      .from('asset_access_settings')
      .select('id, project_id, slug, title, description, logo_url, accent_color, is_enabled')
      .eq('slug', hubSlug)
      .single();

    if (hubError || !hub || !hub.is_enabled) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Resource hub not found' } }, { status: 404 });
    }

    // Load listed, access-enabled assets with a valid booking owner
    const { data: assets, error: assetsError } = await supabase
      .from('community_assets')
      .select(`
        id, name, public_name, public_description, access_mode,
        resource_slug, public_visibility, concurrent_capacity,
        approval_policy, return_required
      `)
      .eq('project_id', hub.project_id)
      .eq('access_enabled', true)
      .eq('public_visibility', 'listed')
      .not('booking_owner_user_id', 'is', null)
      .not('resource_slug', 'is', null)
      .neq('access_mode', 'tracked_only');

    if (assetsError) {
      console.error('Error loading hub assets:', assetsError.message);
      return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to load resource hub' } }, { status: 500 });
    }

    const assetIds = (assets ?? []).map((a) => a.id);

    // Fetch current active loans/reservations (confirmed bookings that haven't ended)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentLoans: any[] = [];
    if (assetIds.length > 0) {
      const now = new Date().toISOString();
      const { data: loanData } = await supabase
        .from('bookings')
        .select('id, invitee_name, start_at, end_at, event_types!inner(asset_id, title)')
        .eq('status', 'confirmed')
        .in('event_types.asset_id', assetIds)
        .gte('end_at', now)
        .order('end_at', { ascending: true })
        .limit(20);
      currentLoans = loanData ?? [];
    }

    // Fetch booking counts per asset for popularity ranking
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let popularityData: any[] = [];
    if (assetIds.length > 0) {
      const { data: bookingCounts } = await supabase
        .from('bookings')
        .select('event_types!inner(asset_id)')
        .in('event_types.asset_id', assetIds)
        .in('status', ['confirmed', 'completed']);
      popularityData = bookingCounts ?? [];
    }

    // Count bookings per asset
    const bookingCountMap = new Map<string, number>();
    for (const b of popularityData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aid = (b as any).event_types?.asset_id;
      if (aid) {
        bookingCountMap.set(aid, (bookingCountMap.get(aid) ?? 0) + 1);
      }
    }

    // Build asset lookup for loan display
    const assetMap = new Map((assets ?? []).map((a) => [a.id, a]));

    // Format current loans
    const formattedLoans = currentLoans.map((loan) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eventType = loan.event_types as any;
      const aid = eventType?.asset_id;
      const asset = aid ? assetMap.get(aid) : null;
      return {
        id: loan.id,
        borrower_name: loan.invitee_name,
        start_at: loan.start_at,
        end_at: loan.end_at,
        asset_name: asset?.public_name || asset?.name || eventType?.title || 'Unknown',
        resource_slug: asset?.resource_slug,
      };
    });

    // Build popularity rankings (top 10)
    const popularResources = (assets ?? [])
      .map((a) => ({
        id: a.id,
        name: a.public_name || a.name,
        resource_slug: a.resource_slug,
        booking_count: bookingCountMap.get(a.id) ?? 0,
      }))
      .filter((a) => a.booking_count > 0)
      .sort((a, b) => b.booking_count - a.booking_count)
      .slice(0, 10);

    return NextResponse.json({
      hub: {
        title: hub.title,
        description: hub.description,
        logo_url: hub.logo_url,
        accent_color: hub.accent_color,
      },
      assets: (assets ?? []).map((a) => ({
        id: a.id,
        name: a.public_name || a.name,
        description: a.public_description,
        access_mode: a.access_mode,
        resource_slug: a.resource_slug,
        approval_policy: a.approval_policy,
        concurrent_capacity: a.concurrent_capacity,
        return_required: a.return_required,
        booking_count: bookingCountMap.get(a.id) ?? 0,
      })),
      current_loans: formattedLoans,
      popular_resources: popularResources,
    });
  } catch (error) {
    console.error('Error in GET /api/resources/[hubSlug]:', error);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Internal server error' } }, { status: 500 });
  }
}
