import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { startRecording } from '@/lib/telnyx/client';
import { decryptApiKey } from '@/lib/telnyx/encryption';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/calls/[id]/record - Start recording on a call
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Get the call with its connection
    const { data: call, error: callError } = await supabaseAny
      .from('calls')
      .select('id, telnyx_call_control_id, recording_enabled, telnyx_connection_id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (callError || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    if (!call.telnyx_call_control_id) {
      return NextResponse.json(
        { error: 'Call control ID not yet available' },
        { status: 400 }
      );
    }

    if (!call.recording_enabled) {
      return NextResponse.json(
        { error: 'Recording not enabled for this call' },
        { status: 400 }
      );
    }

    // Get the connection API key
    const { data: connection } = await supabaseAny
      .from('telnyx_connections')
      .select('api_key')
      .eq('id', call.telnyx_connection_id)
      .single();

    if (!connection?.api_key) {
      return NextResponse.json(
        { error: 'Telnyx connection not found' },
        { status: 400 }
      );
    }

    const decryptedApiKey = decryptApiKey(connection.api_key);

    // Start recording
    await startRecording(decryptedApiKey, call.telnyx_call_control_id);

    // Mark recording as started
    await supabaseAny
      .from('calls')
      .update({ recording_started: true })
      .eq('id', id);

    console.log('[Record] Started recording for call:', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/calls/[id]/record:', error);
    const message = error instanceof Error ? error.message : 'Failed to start recording';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
