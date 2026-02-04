import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { emitAutomationEvent } from '@/lib/automations/engine';

// 1x1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// Create admin client for tracking (bypasses RLS)
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// GET /api/track/open - Track email opens
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trackingId = searchParams.get('tid');

  // Always return the pixel, even if tracking fails
  const response = new NextResponse(TRACKING_PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(TRACKING_PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });

  if (!trackingId) {
    return response;
  }

  // Track the open asynchronously
  try {
    const supabase = createAdminClient();
    if (!supabase) {
      return response;
    }

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const userAgent = request.headers.get('user-agent') ?? null;

    // Find sent email by tracking ID
    const { data: sentEmail } = await supabase
      .from('sent_emails')
      .select('id, project_id, person_id')
      .eq('tracking_id', trackingId)
      .single();

    if (sentEmail) {
      // Record open event
      await supabase
        .from('email_events')
        .insert({
          sent_email_id: sentEmail.id,
          event_type: 'open',
          occurred_at: new Date().toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent,
          metadata: {},
        });

      // Emit automation event
      if (sentEmail.project_id && sentEmail.person_id) {
        emitAutomationEvent({
          projectId: sentEmail.project_id,
          triggerType: 'email.opened',
          entityType: 'person',
          entityId: sentEmail.person_id,
          data: { sent_email_id: sentEmail.id, person_id: sentEmail.person_id },
        });
      }
    }
  } catch (error) {
    // Don't fail the request on tracking errors
    console.error('Error tracking email open:', error);
  }

  return response;
}
