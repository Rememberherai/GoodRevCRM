import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { emitAutomationEvent } from '@/lib/automations/engine';

// Create admin client for tracking (bypasses RLS)
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// GET /api/track/click - Track email link clicks
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trackingId = searchParams.get('tid');
  const targetUrl = searchParams.get('url');

  // If no target URL, redirect to home
  if (!targetUrl) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.redirect(appUrl);
  }

  // searchParams.get() already decodes percent-encoded values
  const decodedUrl = targetUrl;

  // Validate URL length and format
  if (decodedUrl.length > 2048) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.redirect(appUrl);
  }

  // Validate URL to prevent open redirect attacks
  try {
    const url = new URL(decodedUrl);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    // Invalid URL, redirect to home
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.redirect(appUrl);
  }

  // Require a valid tracking ID to prevent open redirect abuse
  if (!trackingId) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.redirect(appUrl);
  }

  // Track the click and verify the tracking ID is legitimate
  try {
    const supabase = createAdminClient();
    if (supabase) {
      // Get request metadata
      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
      const userAgent = request.headers.get('user-agent') ?? null;

      // Find sent email by tracking ID
      const { data: sentEmail } = await supabase
        .from('sent_emails')
        .select('id, project_id, person_id')
        .eq('tracking_id', trackingId)
        .single();

      if (!sentEmail) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
        return NextResponse.redirect(appUrl);
      }

      // Record click event
      await supabase
        .from('email_events')
        .insert({
          sent_email_id: sentEmail.id,
          event_type: 'click',
          occurred_at: new Date().toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent,
          link_url: decodedUrl,
          metadata: {},
        });

      // Emit automation event
      if (sentEmail.project_id && sentEmail.person_id) {
        emitAutomationEvent({
          projectId: sentEmail.project_id,
          triggerType: 'email.clicked',
          entityType: 'person',
          entityId: sentEmail.person_id,
          data: { sent_email_id: sentEmail.id, person_id: sentEmail.person_id, link_url: decodedUrl },
        });
      }
    }
  } catch (error) {
    // Don't fail the redirect on tracking errors
    console.error('Error tracking email click:', error);
  }

  // Redirect to the target URL
  return NextResponse.redirect(decodedUrl);
}
