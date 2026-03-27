import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { updateAssetAccessSettingsSchema } from '@/lib/validators/asset-access';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    const role = await requireCommunityPermission(supabase, user.id, project.id, 'asset_access', 'manage');
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can manage access settings' }, { status: 403 });
    }

    const { data: asset, error: assetError } = await supabase
      .from('community_assets')
      .select('id, name, access_mode, access_enabled, approval_policy, concurrent_capacity, booking_owner_user_id, return_required, resource_slug, public_name, public_description, public_visibility, access_instructions')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const { data: hubSettings } = await supabase
      .from('asset_access_settings')
      .select('*')
      .eq('project_id', project.id)
      .maybeSingle();

    return NextResponse.json({ settings: asset, hub: hubSettings });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/community-assets/[id]/access-settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    const role = await requireCommunityPermission(supabase, user.id, project.id, 'asset_access', 'manage');
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can manage access settings' }, { status: 403 });
    }

    const { data: existingAsset } = await supabase
      .from('community_assets')
      .select('id, access_mode, access_enabled, booking_owner_user_id, resource_slug, public_name')
      .eq('id', id)
      .eq('project_id', project.id)
      .maybeSingle();

    if (!existingAsset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateAssetAccessSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const nextAccessMode = parsed.data.access_mode ?? existingAsset.access_mode;
    const nextAccessEnabled =
      nextAccessMode === 'tracked_only'
        ? false
        : (parsed.data.access_enabled ?? existingAsset.access_enabled);

    const nextSettings = {
      access_mode: nextAccessMode,
      access_enabled: nextAccessEnabled,
      booking_owner_user_id: parsed.data.booking_owner_user_id ?? existingAsset.booking_owner_user_id,
      resource_slug: parsed.data.resource_slug ?? existingAsset.resource_slug,
      public_name: parsed.data.public_name ?? existingAsset.public_name,
    };

    if (nextSettings.access_enabled) {
      const { data: hubSettings } = await supabase
        .from('asset_access_settings')
        .select('id, is_enabled')
        .eq('project_id', project.id)
        .maybeSingle();

      if (!hubSettings?.is_enabled) {
        return NextResponse.json(
          { error: 'Project asset access hub must be configured and enabled before enabling asset access' },
          { status: 400 }
        );
      }

      if (!nextSettings.resource_slug || !nextSettings.public_name || !nextSettings.booking_owner_user_id) {
        return NextResponse.json(
          { error: 'resource_slug, public_name, and booking_owner_user_id are required when access is enabled' },
          { status: 400 }
        );
      }

      const { data: bookingOwner } = await supabase
        .from('project_memberships')
        .select('role')
        .eq('project_id', project.id)
        .eq('user_id', nextSettings.booking_owner_user_id)
        .maybeSingle();

      if (!bookingOwner || !['owner', 'admin', 'staff'].includes(bookingOwner.role)) {
        return NextResponse.json(
          { error: 'Booking owner must be an owner, admin, or staff member on this project' },
          { status: 400 }
        );
      }
    }

    const updatePayload = {
      ...parsed.data,
      ...(nextSettings.access_mode === 'tracked_only' ? { access_enabled: false } : {}),
    };

    const { data: asset, error: updateError } = await supabase
      .from('community_assets')
      .update(updatePayload)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json({ error: 'That public resource slug is already in use' }, { status: 409 });
      }
      throw updateError;
    }
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({ asset });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/community-assets/[id]/access-settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
