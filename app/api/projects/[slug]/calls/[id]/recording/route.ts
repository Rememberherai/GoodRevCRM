import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { listRecordings, getRecording } from '@/lib/telnyx/client';
import { decryptApiKey } from '@/lib/telnyx/encryption';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/calls/[id]/recording - Fetch recording from Telnyx API
// Without ?stream=true: Returns JSON with recording metadata (used by polling)
// With ?stream=true: Proxies the actual audio binary (used by the audio player)
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const url = new URL(request.url);
    const streamMode = url.searchParams.get('stream') === 'true';
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
      .select('id, recording_url, telnyx_recording_id, recording_duration_seconds, recording_enabled, from_number, to_number, started_at, ended_at, telnyx_connection_id, telnyx_call_session_id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (callError || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    // Stream mode: proxy the audio binary to the browser
    if (streamMode) {
      if (call.telnyx_recording_id && call.telnyx_connection_id) {
        return await streamRecording(supabaseAny, call);
      }
      // Fallback: if we have a stored URL but no recording ID, try streaming it directly
      if (call.recording_url) {
        return await streamFromUrl(call.recording_url);
      }
      return NextResponse.json({ error: 'No recording available' }, { status: 404 });
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

    // Prefer mp3, fall back to wav (Outbound Voice Profile recordings are wav-only)
    let recordingUrl = bestMatch.download_urls?.mp3 ?? bestMatch.download_urls?.wav ?? null;
    let durationSeconds = bestMatch.duration_millis
      ? Math.round(bestMatch.duration_millis / 1000)
      : null;

    console.log('[Recording Fetch] Found recording for call', id, {
      recordingId: bestMatch.id,
      status: bestMatch.status,
      url: recordingUrl ? 'present' : 'missing',
      download_urls: JSON.stringify(bestMatch.download_urls),
      durationSeconds,
    });

    // If download_urls is missing from the list response, try fetching the
    // individual recording by ID — the detail endpoint may have more complete data
    if (!recordingUrl && bestMatch.id) {
      try {
        console.log('[Recording Fetch] download_urls missing, fetching individual recording:', bestMatch.id);
        const detail = await getRecording(apiKey, bestMatch.id);
        recordingUrl = detail.data?.download_urls?.mp3 ?? detail.data?.download_urls?.wav ?? null;
        durationSeconds = detail.data?.duration_millis
          ? Math.round(detail.data.duration_millis / 1000)
          : durationSeconds;
        console.log('[Recording Fetch] Individual recording detail:', {
          url: recordingUrl ? 'present' : 'still missing',
          status: detail.data?.status,
          download_urls: JSON.stringify(detail.data?.download_urls),
        });
      } catch (detailErr) {
        console.error('[Recording Fetch] Error fetching individual recording:', detailErr);
      }
    }

    if (recordingUrl) {
      // Save recording URL and Telnyx recording ID to DB
      // The recording ID is used to fetch fresh download URLs for streaming
      const { error: updateError } = await supabaseAny
        .from('calls')
        .update({
          recording_url: recordingUrl,
          recording_duration_seconds: durationSeconds,
          telnyx_recording_id: bestMatch.id,
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

// Proxy the recording audio from Telnyx S3 to the browser.
// Fetches a fresh pre-signed URL via the Telnyx API each time,
// then streams the audio bytes through with proper Content-Type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function streamRecording(supabase: any, call: any): Promise<Response> {
  try {
    const { data: connection } = await supabase
      .from('telnyx_connections')
      .select('api_key')
      .eq('id', call.telnyx_connection_id)
      .single();

    if (!connection?.api_key) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const apiKey = decryptApiKey(connection.api_key);
    const detail = await getRecording(apiKey, call.telnyx_recording_id);
    const freshUrl = detail.data?.download_urls?.mp3 ?? detail.data?.download_urls?.wav;

    if (!freshUrl) {
      return NextResponse.json({ error: 'Recording URL not available' }, { status: 404 });
    }

    // Fetch the audio from S3
    const audioResponse = await fetch(freshUrl);
    if (!audioResponse.ok || !audioResponse.body) {
      return NextResponse.json({ error: 'Failed to fetch recording' }, { status: 502 });
    }

    // Determine content type from URL
    const contentType = freshUrl.includes('.mp3') ? 'audio/mpeg' : 'audio/wav';

    return new Response(audioResponse.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioResponse.headers.get('content-length') || '',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[Recording Stream] Error:', error);
    return NextResponse.json({ error: 'Failed to stream recording' }, { status: 500 });
  }
}

// Stream audio from a stored URL directly (fallback when telnyx_recording_id is missing)
async function streamFromUrl(url: string): Promise<Response> {
  try {
    const audioResponse = await fetch(url);
    if (!audioResponse.ok || !audioResponse.body) {
      return NextResponse.json({ error: 'Failed to fetch recording' }, { status: 502 });
    }

    const contentType = url.includes('.mp3') ? 'audio/mpeg' : 'audio/wav';

    return new Response(audioResponse.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioResponse.headers.get('content-length') || '',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[Recording Stream Fallback] Error:', error);
    return NextResponse.json({ error: 'Failed to stream recording' }, { status: 500 });
  }
}
