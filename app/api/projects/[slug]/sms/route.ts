import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendOutboundSms } from '@/lib/telnyx/sms-service';
import { sendSmsSchema } from '@/lib/validators/sms';

// GET /api/projects/[slug]/sms - List SMS messages
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id');
    const organizationId = searchParams.get('organization_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200);

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project by slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Build query
    let query = supabase
      .from('sms_messages')
      .select(
        `
        id,
        direction,
        status,
        from_number,
        to_number,
        body,
        segments,
        error_code,
        error_message,
        sent_at,
        delivered_at,
        received_at,
        created_at,
        person:people(id, first_name, last_name, email),
        user:users(id, full_name, email)
      `
      )
      .eq('project_id', project.id)
      .order('created_at', { ascending: true });

    // Filter by person or organization
    if (personId) {
      query = query.eq('person_id', personId);
    } else if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    query = query.limit(limit);

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching SMS messages:', error);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    return NextResponse.json({ messages: messages ?? [] });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/sms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/sms - Send a new SMS
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate input
    const validation = sendSmsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project by slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Send SMS
    const result = await sendOutboundSms({
      projectId: project.id,
      userId: user.id,
      toNumber: validation.data.to_number,
      body: validation.data.body,
      personId: validation.data.person_id,
      organizationId: validation.data.organization_id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/sms:', error);
    const message = error instanceof Error ? error.message : 'Failed to send SMS';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
