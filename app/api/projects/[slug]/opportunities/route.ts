import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createOpportunitySchema } from '@/lib/validators/opportunity';
import type { Database } from '@/types/database';

type OpportunityInsert = Database['public']['Tables']['opportunities']['Insert'];
type Opportunity = Database['public']['Tables']['opportunities']['Row'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/opportunities - List opportunities
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
    const stage = searchParams.get('stage');
    const organizationId = searchParams.get('organizationId');
    const primaryContactId = searchParams.get('primaryContactId');

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('opportunities')
      .select('*', { count: 'exact' })
      .eq('project_id', project.id)
      .is('deleted_at', null);

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply stage filter
    if (stage) {
      query = query.eq('stage', stage as Database['public']['Enums']['opportunity_stage']);
    }

    // Apply organization filter
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    // Apply primary contact filter
    if (primaryContactId) {
      query = query.eq('primary_contact_id', primaryContactId);
    }

    // Apply sorting
    const ascending = sortOrder === 'asc';
    query = query.order(sortBy, { ascending });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: opportunities, error, count } = await query;

    if (error) {
      console.error('Error fetching opportunities:', error);
      return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
    }

    return NextResponse.json({
      opportunities: opportunities as Opportunity[],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/opportunities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/opportunities - Create opportunity
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
    const validationResult = createOpportunitySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const oppData: OpportunityInsert = {
      ...validationResult.data,
      project_id: project.id,
      created_by: user.id,
      custom_fields: validationResult.data.custom_fields as OpportunityInsert['custom_fields'],
    };

    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .insert(oppData)
      .select()
      .single();

    if (error) {
      console.error('Error creating opportunity:', error);
      return NextResponse.json({ error: 'Failed to create opportunity' }, { status: 500 });
    }

    return NextResponse.json({ opportunity: opportunity as Opportunity }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/opportunities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
