import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { createCommunityAssetSchema } from '@/lib/validators/community/assets';
import type { Database } from '@/types/database';

type CommunityAssetInsert = Database['public']['Tables']['community_assets']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

function deriveGeocodedStatus(input: {
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_postal_code?: string | null;
  address_country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocoded_status?: CommunityAssetInsert['geocoded_status'];
}) {
  if (input.latitude !== null && input.latitude !== undefined && input.longitude !== null && input.longitude !== undefined) {
    return 'manual';
  }

  const hasAddress = [
    input.address_street,
    input.address_city,
    input.address_state,
    input.address_postal_code,
    input.address_country,
  ].some((part) => Boolean(part));

  if (hasAddress) {
    return 'pending';
  }

  return input.geocoded_status ?? 'failed';
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'community_assets', 'view');

    const { searchParams } = new URL(request.url);
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const category = searchParams.get('category');
    const condition = searchParams.get('condition');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('community_assets')
      .select(`
        *,
        dimension:impact_dimensions(id, label, color),
        steward_person:people(id, first_name, last_name),
        steward_organization:organizations(id, name)
      `, { count: 'exact' })
      .eq('project_id', project.id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) query = query.eq('category', category);
    if (condition) query = query.eq('condition', condition);

    const { data: assets, error, count } = await query;
    if (error) {
      console.error('Error fetching community assets:', error);
      return NextResponse.json({ error: 'Failed to fetch community assets' }, { status: 500 });
    }

    return NextResponse.json({
      assets: assets ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/community-assets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'community_assets', 'create');

    const body = await request.json();
    const validation = createCommunityAssetSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const insertData: CommunityAssetInsert = {
      ...validation.data,
      project_id: project.id,
      geocoded_status: deriveGeocodedStatus(validation.data),
    };

    const { data: asset, error } = await supabase
      .from('community_assets')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating community asset:', error);
      return NextResponse.json({ error: 'Failed to create community asset' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created',
      entityType: 'community_asset',
      entityId: asset.id,
      data: asset as Record<string, unknown>,
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/community-assets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
