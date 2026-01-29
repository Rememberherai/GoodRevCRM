import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createRfpSchema } from '@/lib/validators/rfp';
import type { Database } from '@/types/database';

type RfpInsert = Database['public']['Tables']['rfps']['Insert'];
type Rfp = Database['public']['Tables']['rfps']['Row'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/rfps - List RFPs
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

    // Get project ID from slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const search = searchParams.get('search') ?? '';
    const sortBy = searchParams.get('sortBy') ?? 'created_at';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';
    const status = searchParams.get('status');
    const organizationId = searchParams.get('organizationId');
    const upcoming = searchParams.get('upcoming');

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('rfps')
      .select('*', { count: 'exact' })
      .eq('project_id', project.id)
      .is('deleted_at', null);

    // Apply search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,rfp_number.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status as Database['public']['Enums']['rfp_status']);
    }

    // Apply organization filter
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    // Filter for upcoming deadlines (next 30 days)
    if (upcoming === 'true') {
      const now = new Date().toISOString();
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query
        .gte('due_date', now)
        .lte('due_date', thirtyDaysFromNow)
        .not('status', 'in', '("won","lost","no_bid")');
    }

    // Apply sorting
    const ascending = sortOrder === 'asc';
    query = query.order(sortBy, { ascending });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: rfps, error, count } = await query;

    if (error) {
      console.error('Error fetching RFPs:', error);
      return NextResponse.json({ error: 'Failed to fetch RFPs' }, { status: 500 });
    }

    return NextResponse.json({
      rfps: rfps as Rfp[],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/rfps:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/rfps - Create RFP
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

    // Get project ID from slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = createRfpSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const rfpData: RfpInsert = {
      ...validationResult.data,
      project_id: project.id,
      created_by: user.id,
      custom_fields: validationResult.data.custom_fields as RfpInsert['custom_fields'],
    };

    const { data: rfp, error } = await supabase
      .from('rfps')
      .insert(rfpData)
      .select()
      .single();

    if (error) {
      console.error('Error creating RFP:', error);
      return NextResponse.json({ error: 'Failed to create RFP' }, { status: 500 });
    }

    return NextResponse.json({ rfp: rfp as Rfp }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/rfps:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
