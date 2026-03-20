import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import {
  buildAddressLabel,
  computeMapCenter,
  type CommunityAssetMapPoint,
  type CommunityMapData,
  type HouseholdMapPoint,
  type OrganizationMapPoint,
  type ProgramMapPoint,
} from '@/lib/community/map';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, project_type, settings')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.project_type !== 'community') {
      return NextResponse.json({ error: 'Community map is only available for community projects' }, { status: 404 });
    }

    await requireCommunityPermission(supabase, user.id, project.id, 'households', 'view');
    await requireCommunityPermission(supabase, user.id, project.id, 'community_assets', 'view');
    await requireCommunityPermission(supabase, user.id, project.id, 'programs', 'view');

    const [householdsResult, assetsResult, programsResult, organizationsResult] = await Promise.all([
      supabase
        .from('households')
        .select('id, name, latitude, longitude, address_street, address_city, address_state, household_size')
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null),
      supabase
        .from('community_assets')
        .select('id, name, latitude, longitude, category, condition, address_street, address_city, address_state')
        .eq('project_id', project.id)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null),
      supabase
        .from('programs')
        .select('id, name, status, location_name, location_latitude, location_longitude')
        .eq('project_id', project.id)
        .not('location_latitude', 'is', null)
        .not('location_longitude', 'is', null),
      supabase
        .from('organizations')
        .select('id, name, latitude, longitude, address_city, address_state, is_referral_partner')
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null),
    ]);

    const households: HouseholdMapPoint[] = ((householdsResult.data ?? []) as Array<{
      id: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
      address_street: string | null;
      address_city: string | null;
      address_state: string | null;
      household_size: number | null;
    }>)
      .filter((row): row is {
        id: string;
        name: string;
        latitude: number;
        longitude: number;
        address_street: string | null;
        address_city: string | null;
        address_state: string | null;
        household_size: number | null;
      } => row.latitude !== null && row.longitude !== null)
      .map((row) => ({
        id: row.id,
        type: 'household' as const,
        name: row.name,
        latitude: row.latitude,
        longitude: row.longitude,
        addressLabel: buildAddressLabel([row.address_street, row.address_city, row.address_state]),
        householdSize: row.household_size,
      }));

    const assets: CommunityAssetMapPoint[] = ((assetsResult.data ?? []) as Array<{
      id: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
      category: string;
      condition: string;
      address_street: string | null;
      address_city: string | null;
      address_state: string | null;
    }>)
      .filter((row): row is {
        id: string;
        name: string;
        latitude: number;
        longitude: number;
        category: string;
        condition: string;
        address_street: string | null;
        address_city: string | null;
        address_state: string | null;
      } => row.latitude !== null && row.longitude !== null)
      .map((row) => ({
        id: row.id,
        type: 'asset' as const,
        name: row.name,
        latitude: row.latitude,
        longitude: row.longitude,
        category: row.category,
        condition: row.condition,
        addressLabel: buildAddressLabel([row.address_street, row.address_city, row.address_state]),
      }));

    const programs: ProgramMapPoint[] = ((programsResult.data ?? []) as Array<{
      id: string;
      name: string;
      status: string;
      location_name: string | null;
      location_latitude: number | null;
      location_longitude: number | null;
    }>)
      .filter((row): row is {
        id: string;
        name: string;
        status: string;
        location_name: string | null;
        location_latitude: number;
        location_longitude: number;
      } => row.location_latitude !== null && row.location_longitude !== null)
      .map((row) => ({
        id: row.id,
        type: 'program' as const,
        name: row.name,
        latitude: row.location_latitude,
        longitude: row.location_longitude,
        status: row.status,
        locationName: row.location_name,
      }));

    const organizations: OrganizationMapPoint[] = ((organizationsResult.data ?? []) as Array<{
      id: string;
      name: string;
      latitude: number | null;
      longitude: number | null;
      address_city: string | null;
      address_state: string | null;
      is_referral_partner: boolean | null;
    }>)
      .filter((row): row is {
        id: string;
        name: string;
        latitude: number;
        longitude: number;
        address_city: string | null;
        address_state: string | null;
        is_referral_partner: boolean | null;
      } => row.latitude !== null && row.longitude !== null)
      .map((row) => ({
        id: row.id,
        type: 'organization' as const,
        name: row.name,
        latitude: row.latitude,
        longitude: row.longitude,
        isReferralPartner: Boolean(row.is_referral_partner),
        addressLabel: buildAddressLabel([row.address_city, row.address_state]),
      }));

    const settings = (project.settings ?? {}) as {
      default_map_center?: { latitude?: number; longitude?: number; zoom?: number };
    };

    const data: CommunityMapData = {
      center: computeMapCenter(
        [households, assets, programs, organizations],
        settings.default_map_center
      ),
      households,
      assets,
      programs,
      organizations,
    };

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/community/map:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
