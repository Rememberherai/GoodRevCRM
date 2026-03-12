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
    const groupByOrg = isBulk ? (bulkResult.data.group_by_org ?? true) : false;

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

    // Verify all person_ids belong to this project (batch to avoid Supabase row/URL limits)
    const BATCH_SIZE = 300;
    const validPersonIds = new Set<string>();
    for (let i = 0; i < personIds.length; i += BATCH_SIZE) {
      const batch = personIds.slice(i, i + BATCH_SIZE);
      const { data: validPeople } = await supabaseAny
        .from('people')
        .select('id')
        .in('id', batch)
        .eq('project_id', project.id);
      for (const p of (validPeople ?? []) as { id: string }[]) {
        validPersonIds.add(p.id);
      }
    }
    const invalidIds = personIds.filter((pid) => !validPersonIds.has(pid));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: 'One or more person IDs do not belong to this project' },
        { status: 400 }
      );
    }

    // Remove any non-active enrollments for these people so re-enrollment works
    const NON_ACTIVE_STATUSES = ['completed', 'cancelled', 'bounced', 'replied'];
    for (let i = 0; i < personIds.length; i += BATCH_SIZE) {
      const batch = personIds.slice(i, i + BATCH_SIZE);
      await supabaseAny
        .from('sequence_enrollments')
        .delete()
        .eq('sequence_id', id)
        .in('person_id', batch)
        .in('status', NON_ACTIVE_STATUSES);
    }

    // Build enrollment records, grouping by org if requested
    let enrollments: {
      sequence_id: string;
      person_id: string;
      gmail_connection_id: string;
      next_send_at: string;
      created_by: string;
      co_recipient_ids?: string[];
    }[];

    if (groupByOrg && personIds.length > 1) {
      // Look up org memberships to group people by org (batched)
      const orgLinks: { person_id: string; organization_id: string }[] = [];
      for (let i = 0; i < personIds.length; i += BATCH_SIZE) {
        const batch = personIds.slice(i, i + BATCH_SIZE);
        const { data } = await supabaseAny
          .from('person_organizations')
          .select('person_id, organization_id')
          .in('person_id', batch)
          .eq('is_primary', true);
        if (data) orgLinks.push(...data);
      }

      // Group person IDs by org
      const orgGroups = new Map<string, string[]>();
      const ungrouped: string[] = [];
      const personOrgMap = new Map<string, string>();

      for (const link of (orgLinks ?? []) as { person_id: string; organization_id: string }[]) {
        personOrgMap.set(link.person_id, link.organization_id);
      }

      for (const pid of personIds) {
        const orgId = personOrgMap.get(pid);
        if (orgId) {
          const group = orgGroups.get(orgId) ?? [];
          group.push(pid);
          orgGroups.set(orgId, group);
        } else {
          ungrouped.push(pid);
        }
      }

      enrollments = [];
      const nextSendAt = startAt ?? new Date().toISOString();

      // For each org group, first person is primary, rest are co-recipients
      for (const [, groupPersonIds] of orgGroups) {
        const [primary, ...coRecipients] = groupPersonIds;
        if (!primary) continue;
        enrollments.push({
          sequence_id: id,
          person_id: primary,
          gmail_connection_id: gmailConnectionId,
          next_send_at: nextSendAt,
          created_by: user.id,
          ...(coRecipients.length > 0 ? { co_recipient_ids: coRecipients } : {}),
        });
      }

      // Ungrouped people get individual enrollments
      for (const pid of ungrouped) {
        enrollments.push({
          sequence_id: id,
          person_id: pid,
          gmail_connection_id: gmailConnectionId,
          next_send_at: nextSendAt,
          created_by: user.id,
        });
      }
    } else {
      // No grouping - one enrollment per person
      enrollments = personIds.map((personId) => ({
        sequence_id: id,
        person_id: personId,
        gmail_connection_id: gmailConnectionId,
        next_send_at: startAt ?? new Date().toISOString(),
        created_by: user.id,
      }));
    }

    // Insert enrollments in batches
    const created: typeof enrollments = [];
    for (let i = 0; i < enrollments.length; i += BATCH_SIZE) {
      const batch = enrollments.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabaseAny
        .from('sequence_enrollments')
        .insert(batch)
        .select();

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            { error: 'One or more people are already actively enrolled in this sequence. Pause or cancel their enrollment first.' },
            { status: 409 }
          );
        }
        console.error('Error creating enrollments:', error);
        return NextResponse.json({ error: 'Failed to create enrollments' }, { status: 500 });
      }
      if (data) created.push(...data);
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
