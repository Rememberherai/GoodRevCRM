import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { enrollPersonSchema, bulkEnrollSchema, enrollmentQuerySchema } from '@/lib/validators/sequence';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/sequences/[id]/enrollments - List enrollments
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    const queryResult = enrollmentQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { status, limit, offset } = queryResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Verify sequence belongs to this project
    const { data: sequence } = await supabaseAny
      .from('sequences')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    let query = supabaseAny
      .from('sequence_enrollments')
      .select(`
        *,
        person:people(id, first_name, last_name, email)
      `)
      .eq('sequence_id', id);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: enrollments, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching enrollments:', error);
      return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 });
    }

    return NextResponse.json({
      enrollments: enrollments ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/sequences/[id]/enrollments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/sequences/[id]/enrollments - Enroll person(s)
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Verify sequence exists and is active
    const { data: sequence } = await supabaseAny
      .from('sequences')
      .select('id, status')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    if (sequence.status !== 'active') {
      return NextResponse.json(
        { error: 'Cannot enroll in inactive sequence' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Check if single or bulk enrollment
    const singleResult = enrollPersonSchema.safeParse(body);
    const bulkResult = bulkEnrollSchema.safeParse(body);

    if (!singleResult.success && !bulkResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: singleResult.error.flatten() },
        { status: 400 }
      );
    }

    const isBulk = bulkResult.success;
    const personIds = isBulk ? bulkResult.data.person_ids : [singleResult.data!.person_id];
    const gmailConnectionId = isBulk
      ? bulkResult.data.gmail_connection_id
      : singleResult.data!.gmail_connection_id;
    const startAt = isBulk ? bulkResult.data.start_at : singleResult.data?.start_at;

    // Verify Gmail connection belongs to user
    const { data: connection } = await supabaseAny
      .from('gmail_connections')
      .select('id')
      .eq('id', gmailConnectionId)
      .eq('user_id', user.id)
      .eq('status', 'connected')
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'Gmail connection not found or inactive' },
        { status: 400 }
      );
    }

    // Verify all person_ids belong to this project
    const { data: validPeople } = await supabaseAny
      .from('people')
      .select('id')
      .in('id', personIds)
      .eq('project_id', project.id);

    const validPersonIds = new Set((validPeople ?? []).map((p: { id: string }) => p.id));
    const invalidIds = personIds.filter((pid) => !validPersonIds.has(pid));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: 'One or more person IDs do not belong to this project' },
        { status: 400 }
      );
    }

    // Create enrollments
    const enrollments = personIds.map((personId) => ({
      sequence_id: id,
      person_id: personId,
      gmail_connection_id: gmailConnectionId,
      next_send_at: startAt ?? new Date().toISOString(),
      created_by: user.id,
    }));

    const { data: created, error } = await supabaseAny
      .from('sequence_enrollments')
      .insert(enrollments)
      .select();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'One or more people are already enrolled in this sequence' },
          { status: 409 }
        );
      }
      console.error('Error creating enrollments:', error);
      return NextResponse.json({ error: 'Failed to create enrollments' }, { status: 500 });
    }

    return NextResponse.json(
      { enrollments: created, count: created?.length ?? 0 },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/sequences/[id]/enrollments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
