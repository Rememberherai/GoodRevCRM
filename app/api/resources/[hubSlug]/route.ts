/**
 * Public hub listing API — resolves hubSlug to project, returns hub config + listed assets.
 * No auth required.
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
      })),
    });
  } catch (error) {
    console.error('Error in GET /api/resources/[hubSlug]:', error);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Internal server error' } }, { status: 500 });
  }
}
