import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getEPAEchoClient } from '@/lib/epa-echo/client';
import { epaImportQuerySchema, epaImportCreateSchema } from '@/lib/validators/epa-import';
import type { Database } from '@/types/database';

type OrganizationInsert = Database['public']['Tables']['organizations']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/epa-import - Query EPA for POTW facilities
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse and validate query params
    const { searchParams } = new URL(request.url);
    const queryParams = {
      state: searchParams.get('state') || undefined,
      min_design_flow: searchParams.get('min_design_flow') || undefined,
      max_results: searchParams.get('max_results') || undefined,
      sort_by: searchParams.get('sort_by') || undefined,
      sort_order: searchParams.get('sort_order') || undefined,
    };

    const validation = epaImportQuerySchema.safeParse(queryParams);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const params = validation.data;

    // Query EPA ECHO
    const client = getEPAEchoClient();
    const facilities = await client.fetchAllFacilities(
      {
        state: params.state,
        minDesignFlow: params.min_design_flow,
      },
      params.max_results
    );

    // Apply additional sorting based on params
    let sorted = [...facilities];

    sorted.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (params.sort_by) {
        case 'design_flow':
          aVal = a.design_flow_mgd ?? 0;
          bVal = b.design_flow_mgd ?? 0;
          break;
        case 'name':
          aVal = (a.name ?? '').toLowerCase();
          bVal = (b.name ?? '').toLowerCase();
          break;
        case 'city':
          aVal = (a.city ?? '').toLowerCase();
          bVal = (b.city ?? '').toLowerCase();
          break;
      }

      if (params.sort_order === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      }
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    });

    return NextResponse.json({
      facilities: sorted,
      total: sorted.length,
    });
  } catch (error) {
    console.error('EPA import query error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch EPA data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/projects/[slug]/epa-import - Import selected facilities as organizations
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = epaImportCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Map EPA facilities to organization records
    const organizations: OrganizationInsert[] = validation.data.facilities.map((f) => ({
      project_id: project.id,
      name: f.name,
      industry: 'Wastewater Treatment',
      address_street: f.street,
      address_city: f.city,
      address_state: f.state,
      address_postal_code: f.zip,
      address_country: 'USA',
      created_by: user.id,
      custom_fields: {
        npdes_permit_id: f.permit_id,
        design_flow_mgd: f.design_flow_mgd,
        actual_flow_mgd: f.actual_flow_mgd,
        facility_type: 'POTW',
        county: f.county,
        latitude: f.latitude,
        longitude: f.longitude,
        data_source: 'EPA ECHO',
      },
    }));

    // Bulk insert organizations
    const { data: created, error } = await supabase
      .from('organizations')
      .insert(organizations)
      .select();

    if (error) {
      console.error('Failed to create organizations:', error);
      return NextResponse.json(
        { error: 'Failed to create organizations', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        created_count: created?.length ?? 0,
        organizations: created,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('EPA import create error:', error);
    const message = error instanceof Error ? error.message : 'Import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
