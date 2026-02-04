import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { callQuerySchema, initiateCallSchema } from '@/lib/validators/call';
import { initiateOutboundCall } from '@/lib/telnyx/service';


interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/calls - List calls
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const queryResult = callQuerySchema.safeParse({
      person_id: searchParams.get('person_id') ?? undefined,
      organization_id: searchParams.get('organization_id') ?? undefined,
      opportunity_id: searchParams.get('opportunity_id') ?? undefined,
      user_id: searchParams.get('user_id') ?? undefined,
      direction: searchParams.get('direction') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      disposition: searchParams.get('disposition') ?? undefined,
      start_date: searchParams.get('start_date') ?? undefined,
      end_date: searchParams.get('end_date') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const {
      person_id, organization_id, opportunity_id, user_id,
      direction, status, disposition, start_date, end_date,
      limit, offset,
    } = queryResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    let query = supabaseAny
      .from('calls')
      .select(`
        *,
        person:people!calls_person_id_fkey(id, first_name, last_name, email),
        organization:organizations!calls_organization_id_fkey(id, name),
        user:users!calls_user_id_fkey(id, full_name, email, avatar_url)
      `)
      .eq('project_id', project.id);

    if (person_id) query = query.eq('person_id', person_id);
    if (organization_id) query = query.eq('organization_id', organization_id);
    if (opportunity_id) query = query.eq('opportunity_id', opportunity_id);
    if (user_id) query = query.eq('user_id', user_id);
    if (direction) query = query.eq('direction', direction);
    if (status) query = query.eq('status', status);
    if (disposition) query = query.eq('disposition', disposition);
    if (start_date) query = query.gte('started_at', start_date);
    if (end_date) query = query.lte('started_at', end_date);

    const { data: calls, error } = await query
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching calls:', error);
      return NextResponse.json({ error: 'Failed to fetch calls' }, { status: 500 });
    }

    return NextResponse.json({
      calls: calls ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/calls:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/calls - Initiate an outbound call
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = initiateCallSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = validationResult.data;

    const result = await initiateOutboundCall({
      projectId: project.id,
      userId: user.id,
      toNumber: input.to_number,
      personId: input.person_id,
      organizationId: input.organization_id,
      opportunityId: input.opportunity_id,
      rfpId: input.rfp_id,
      record: input.record,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/calls:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
