import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { listRecordings } from '@/lib/telnyx/client';
import { decryptApiKey } from '@/lib/telnyx/encryption';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/calls/[id]/recording - Fetch recording from Telnyx API
// This endpoint checks if a recording exists for the call. If the recording_url
// is already in the DB, it returns it. Otherwise, it queries the Telnyx Recordings
// API to find and save the recording URL.
export async function GET(_request: Request, context: RouteContext) {
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

    // Fetch the call record
    const { data: call, error: callError } = await supabaseAny
      .from('calls')
      .select('id, recording_url, recording_duration_seconds, recording_enabled, from_number, to_number, started_at, ended_at, telnyx_connection_id, telnyx_call_session_id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (callError || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    // If recording URL already exists, return it
    if (call.recording_url) {
      return NextResponse.json({
        recording_url: call.recording_url,
        recording_duration_seconds: call.recording_duration_seconds,
      });
    }

    // If recording is not enabled, return null
    if (!call.recording_enabled) {
      return NextResponse.json({
        recording_url: null,
        recording_duration_seconds: null,
      });
    }

    // If call hasn't ended yet, recording won't be ready
    if (!call.ended_at) {
      return NextResponse.json({
        recording_url: null,
        recording_duration_seconds: null,
      });
    }

    // Fetch the Telnyx connection to get the API key
    if (!call.telnyx_connection_id) {
      console.log('[Recording Fetch] No telnyx_connection_id on call', id);
      return NextResponse.json({
        recording_url: null,
        recording_duration_seconds: null,
      });
    }

    const { data: connection } = await supabaseAny
      .from('telnyx_connections')
      .select('api_key, sip_connection_id')
      .eq('id', call.telnyx_connection_id)
      .single();

    if (!connection?.api_key) {
      console.log('[Recording Fetch] No API key for connection', call.telnyx_connection_id);
      return NextResponse.json({
        recording_url: null,
        recording_duration_seconds: null,
      });
    }

    const apiKey = decryptApiKey(connection.api_key);

    // Query Telnyx Recordings API
    // Try multiple filter strategies to find the recording
    console.log('[Recording Fetch] Searching Telnyx API for call', id, {
      connectionId: connection.sip_connection_id,
      from: call.from_number,
      to: call.to_number,
      startedAt: call.started_at,
      sessionId: call.telnyx_call_session_id,
    });

    let recordings: Awaited<ReturnType<typeof listRecordings>> = [];

    // Strategy 1: Filter by connection_id + created_after
    if (connection.sip_connection_id) {
      try {
        recordings = await listRecordings(apiKey, {
          connectionId: connection.sip_connection_id,
          createdAfter: call.started_at,
        });
        console.log('[Recording Fetch] Strategy 1 (connection_id) found', recordings.length, 'recordings');
      } catch (err) {
        console.error('[Recording Fetch] Strategy 1 failed:', err);
      }
    }

    // Strategy 2: Filter by from number + created_after
    if (recordings.length === 0 && call.from_number) {
      try {
        recordings = await listRecordings(apiKey, {
          from: call.from_number,
          createdAfter: call.started_at,
        });
        console.log('[Recording Fetch] Strategy 2 (from number) found', recordings.length, 'recordings');
      } catch (err) {
        console.error('[Recording Fetch] Strategy 2 failed:', err);
      }
    }

    // Strategy 3: Filter by to number + created_after
    if (recordings.length === 0 && call.to_number) {
      try {
        recordings = await listRecordings(apiKey, {
          to: call.to_number,
          createdAfter: call.started_at,
        });
        console.log('[Recording Fetch] Strategy 3 (to number) found', recordings.length, 'recordings');
      } catch (err) {
        console.error('[Recording Fetch] Strategy 3 failed:', err);
      }
    }

    if (recordings.length === 0) {
      console.log('[Recording Fetch] No recordings found for call', id);
      return NextResponse.json({
        recording_url: null,
        recording_duration_seconds: null,
      });
    }

    // Find the best matching recording
    // If we have a session ID, prefer that match
    const firstRecording = recordings[0];
    if (!firstRecording) {
      return NextResponse.json({
        recording_url: null,
        recording_duration_seconds: null,
      });
    }

    let bestMatch = firstRecording;
    if (call.telnyx_call_session_id) {
      const sessionMatch = recordings.find(
        (r) => r.call_session_id === call.telnyx_call_session_id
      );
      if (sessionMatch) {
        bestMatch = sessionMatch;
      }
    }

    // If multiple recordings, pick the one closest to our call's start time
    if (recordings.length > 1 && !call.telnyx_call_session_id) {
      const callStart = new Date(call.started_at).getTime();
      bestMatch = recordings.reduce((closest, rec) => {
        const recTime = new Date(rec.recording_started_at || rec.created_at).getTime();
        const closestTime = new Date(closest.recording_started_at || closest.created_at).getTime();
        return Math.abs(recTime - callStart) < Math.abs(closestTime - callStart)
          ? rec
          : closest;
      });
    }

    const recordingUrl = bestMatch.download_urls?.mp3 ?? null;
    const durationSeconds = bestMatch.duration_millis
      ? Math.round(bestMatch.duration_millis / 1000)
      : null;

    console.log('[Recording Fetch] Found recording for call', id, {
      recordingId: bestMatch.id,
      url: recordingUrl ? 'present' : 'missing',
      durationSeconds,
    });

    if (recordingUrl) {
      // Save to DB so we don't need to fetch again
      const { error: updateError } = await supabaseAny
        .from('calls')
        .update({
          recording_url: recordingUrl,
          recording_duration_seconds: durationSeconds,
        })
        .eq('id', id);

      if (updateError) {
        console.error('[Recording Fetch] Error saving recording URL to DB:', updateError);
      }
    }

    return NextResponse.json({
      recording_url: recordingUrl,
      recording_duration_seconds: durationSeconds,
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/calls/[id]/recording:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
