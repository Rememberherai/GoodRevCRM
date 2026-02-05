import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { listRecordings, getRecording, transcribeRecording } from '@/lib/telnyx/client';
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

    // Fetch the call record with person info for the player page
    const { data: call, error: callError } = await supabaseAny
      .from('calls')
      .select('id, recording_url, telnyx_recording_id, recording_duration_seconds, recording_enabled, from_number, to_number, started_at, ended_at, telnyx_connection_id, telnyx_call_session_id, direction, duration_seconds, talk_time_seconds, disposition, disposition_notes, person:people(first_name, last_name), transcription')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (callError || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    // Stream mode: redirect to a fresh pre-signed URL for the audio player
    const apiPath = `/api/projects/${slug}/calls/${id}/recording`;
    if (streamMode) {
      if (call.telnyx_recording_id && call.telnyx_connection_id) {
        return await serveRecordingPlayer(supabaseAny, call, apiPath);
      }
      // Fallback: if we have a stored URL but no recording ID, serve player with stored URL
      // (may fail if the URL has expired, but it's the best we can do)
      if (call.recording_url) {
        return new Response(buildPlayerHtml(call.recording_url, call, apiPath), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return NextResponse.json({ error: 'No recording available' }, { status: 404 });
    }

    // If recording URL already exists, return it
    if (call.recording_url) {
      // If we have a recording URL but no telnyx_recording_id, try to backfill it
      // by searching the Telnyx API (needed for stream mode redirect)
      if (!call.telnyx_recording_id && call.telnyx_connection_id) {
        backfillRecordingId(supabaseAny, call).catch((err) =>
          console.error('[Recording] Backfill recording ID failed:', err)
        );
      }
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

// Backfill telnyx_recording_id for calls that have a recording_url but no recording ID.
// Runs fire-and-forget so it doesn't block the response.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function backfillRecordingId(supabase: any, call: any): Promise<void> {
  const { data: connection } = await supabase
    .from('telnyx_connections')
    .select('api_key, sip_connection_id')
    .eq('id', call.telnyx_connection_id)
    .single();

  if (!connection?.api_key) return;

  const apiKey = decryptApiKey(connection.api_key);
  const recordings = await listRecordings(apiKey, {
    connectionId: connection.sip_connection_id,
    createdAfter: call.started_at,
  });

  if (recordings.length > 0) {
    const match = call.telnyx_call_session_id
      ? recordings.find((r) => r.call_session_id === call.telnyx_call_session_id) ?? recordings[0]
      : recordings[0];

    if (match) {
      await supabase
        .from('calls')
        .update({ telnyx_recording_id: match.id })
        .eq('id', call.id);
      console.log('[Recording] Backfilled recording ID for call', call.id, '->', match.id);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function esc(str: any): string {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPlayerHtml(audioUrl: string, call: any, apiPath: string): string {
  const person = call.person;
  const contactName = person ? `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() : null;
  const phoneNumber = call.direction === 'outbound' ? call.to_number : call.from_number;
  const dirLabel = call.direction === 'outbound' ? 'Outbound' : 'Inbound';
  const date = call.started_at
    ? new Date(call.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';
  const dur = call.talk_time_seconds || call.duration_seconds;
  const durationStr = dur ? `${Math.floor(dur / 60)}m ${dur % 60}s` : '';
  const transcription = call.transcription ?? null;
  const hasRecording = !!call.telnyx_recording_id;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Call Recording${contactName ? ` - ${esc(contactName)}` : ''} | GoodRev</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;background:#09090b;color:#fafafa;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center}
.header{width:100%;padding:16px 24px;border-bottom:1px solid #27272a;display:flex;align-items:center;gap:12px}
.logo{font-size:20px;font-weight:700;color:#fafafa;letter-spacing:-0.5px}
.logo span{color:#3b82f6}
.container{width:100%;max-width:720px;padding:32px 24px;flex:1}
.meta{margin-bottom:24px}
.contact-name{font-size:24px;font-weight:600;margin-bottom:4px}
.details{display:flex;gap:16px;color:#a1a1aa;font-size:14px;flex-wrap:wrap}
.badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:12px;font-weight:500}
.badge-outbound{background:#1e3a5f;color:#60a5fa}
.badge-inbound{background:#14532d;color:#4ade80}
.player-card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:32px}
audio{width:100%;height:40px;border-radius:8px}
.transcript-section{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px}
.transcript-header{font-size:16px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.transcript-badge{font-size:11px;padding:2px 6px;border-radius:4px;background:#27272a;color:#a1a1aa;font-weight:500}
.transcript-badge-ready{background:#14532d;color:#4ade80}
.transcript-content{color:#d4d4d8;font-size:14px;line-height:1.7;white-space:pre-wrap}
.transcript-empty{color:#52525b;font-size:14px;font-style:italic}
.transcribe-btn{background:#3b82f6;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background 0.15s}
.transcribe-btn:hover{background:#2563eb}
.transcribe-btn:disabled{background:#27272a;color:#71717a;cursor:not-allowed}
.spinner{display:inline-block;width:14px;height:14px;border:2px solid #71717a;border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="header">
  <div class="logo">Good<span>Rev</span></div>
</div>
<div class="container">
  <div class="meta">
    <div class="contact-name">${contactName ? esc(contactName) : esc(phoneNumber)}</div>
    <div class="details">
      ${contactName && phoneNumber ? `<span>${esc(phoneNumber)}</span>` : ''}
      <span class="badge badge-${call.direction === 'outbound' ? 'outbound' : 'inbound'}">${esc(dirLabel)}</span>
      ${date ? `<span>${esc(date)}</span>` : ''}
      ${durationStr ? `<span>${esc(durationStr)}</span>` : ''}
    </div>
  </div>
  <div class="player-card">
    <audio controls autoplay src="${esc(audioUrl)}"></audio>
  </div>
  <div class="transcript-section">
    <div class="transcript-header">
      Transcription
      <span id="transcriptBadge" class="transcript-badge ${transcription ? 'transcript-badge-ready' : ''}">${transcription ? 'Available' : hasRecording ? 'Not yet transcribed' : 'No recording'}</span>
    </div>
    <div id="transcriptBody">
    ${transcription
      ? `<div class="transcript-content">${esc(transcription)}</div>`
      : hasRecording
        ? `<button id="transcribeBtn" class="transcribe-btn" onclick="doTranscribe()">Transcribe Recording</button>`
        : `<div class="transcript-empty">No recording available for transcription.</div>`}
    </div>
  </div>
</div>
${hasRecording && !transcription ? `<script>
async function doTranscribe() {
  var btn = document.getElementById('transcribeBtn');
  var badge = document.getElementById('transcriptBadge');
  var body = document.getElementById('transcriptBody');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Transcribing...';
  badge.textContent = 'Processing...';
  try {
    var res = await fetch('${esc(apiPath)}', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error('Failed: ' + res.status);
    var data = await res.json();
    if (data.transcription) {
      badge.textContent = 'Available';
      badge.className = 'transcript-badge transcript-badge-ready';
      body.innerHTML = '<div class="transcript-content">' + data.transcription.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
    } else {
      badge.textContent = 'Failed';
      body.innerHTML = '<div class="transcript-empty">Transcription returned empty. Try again later.</div>';
    }
  } catch(e) {
    badge.textContent = 'Error';
    body.innerHTML = '<div class="transcript-empty">Transcription failed: ' + e.message + '</div>';
  }
}
</script>` : ''}
</body>
</html>`;
}

// Serve a branded HTML page with an audio player pointing to the fresh S3 URL.
// Direct redirects to S3 cause downloads due to Content-Disposition headers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function serveRecordingPlayer(supabase: any, call: any, apiPath: string): Promise<Response> {
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

    // Trigger background transcription if recording exists but no transcription yet
    if (call.telnyx_recording_id && !call.transcription) {
      triggerTranscription(supabase, call, apiKey).catch((err) =>
        console.error('[Transcription] Background trigger failed:', err)
      );
    }

    return new Response(buildPlayerHtml(freshUrl, call, apiPath), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('[Recording Player] Error:', error);
    return NextResponse.json({ error: 'Failed to get recording' }, { status: 500 });
  }
}

// Background transcription: fetches STT from Telnyx and saves to DB
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function triggerTranscription(supabase: any, call: any, apiKey: string): Promise<void> {
  console.log('[Transcription] Starting transcription for call', call.id, 'recording', call.telnyx_recording_id);

  const result = await transcribeRecording(apiKey, call.telnyx_recording_id);

  if (!result.text) {
    console.log('[Transcription] No text returned for call', call.id);
    return;
  }

  const { error: updateError } = await supabase
    .from('calls')
    .update({ transcription: result.text })
    .eq('id', call.id);

  if (updateError) {
    console.error('[Transcription] Error saving transcription to DB:', updateError);
  } else {
    console.log('[Transcription] Saved transcription for call', call.id, `(${result.text.length} chars)`);
  }
}

// POST /api/projects/[slug]/calls/[id]/recording - Manually trigger transcription
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

    const { data: call, error: callError } = await supabaseAny
      .from('calls')
      .select('id, telnyx_recording_id, telnyx_connection_id, transcription')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (callError || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    if (!call.telnyx_recording_id) {
      return NextResponse.json({ error: 'No recording available for this call' }, { status: 400 });
    }

    if (call.transcription) {
      return NextResponse.json({ transcription: call.transcription });
    }

    // Get API key from connection
    const { data: connection } = await supabaseAny
      .from('telnyx_connections')
      .select('api_key')
      .eq('id', call.telnyx_connection_id)
      .single();

    if (!connection?.api_key) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const apiKey = decryptApiKey(connection.api_key);

    await triggerTranscription(supabaseAny, call, apiKey);

    // Re-fetch to get the saved transcription
    const { data: updated } = await supabaseAny
      .from('calls')
      .select('transcription')
      .eq('id', id)
      .single();

    return NextResponse.json({ transcription: updated?.transcription ?? null });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/calls/[id]/recording:', error);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
