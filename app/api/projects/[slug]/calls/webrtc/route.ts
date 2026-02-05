import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { initiateCallSchema } from '@/lib/validators/call';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// POST /api/projects/[slug]/calls/webrtc - Create call record for WebRTC-initiated calls
// This endpoint creates the database record but does NOT call the Telnyx REST API
// because the WebRTC SDK handles the actual call initiation in the browser
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

    // Get the Telnyx connection to get the from number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connection } = await (supabase as any)
      .from('telnyx_connections')
      .select('id, phone_number, record_calls')
      .eq('project_id', project.id)
      .eq('status', 'active')
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'No active Telnyx connection for this project' },
        { status: 400 }
      );
    }

    // Create the call record in the database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: call, error } = await (supabase as any)
      .from('calls')
      .insert({
        project_id: project.id,
        telnyx_connection_id: connection.id,
        direction: 'outbound',
        status: 'initiated',
        from_number: connection.phone_number,
        to_number: input.to_number,
        user_id: user.id,
        person_id: input.person_id ?? null,
        organization_id: input.organization_id ?? null,
        opportunity_id: input.opportunity_id ?? null,
        rfp_id: input.rfp_id ?? null,
        recording_enabled: input.record ?? connection.record_calls ?? false,
      })
      .select('id')
      .single();

    if (error || !call) {
      console.error('Error creating call record:', error);
      return NextResponse.json({ error: 'Failed to create call record' }, { status: 500 });
    }

    return NextResponse.json({
      callId: call.id,
      fromNumber: connection.phone_number,
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/calls/webrtc:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
