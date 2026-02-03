import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { gmailTestSchema } from '@/lib/validators/gmail';
import { getValidAccessToken } from '@/lib/gmail/service';
import { isTokenExpired } from '@/lib/gmail/oauth';
import type { GmailConnection } from '@/types/gmail';

const GMAIL_API_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

interface TestResult {
  status: 'pass' | 'fail';
  message: string;
  duration_ms: number;
  details?: Record<string, unknown>;
}

async function testConnection(accessToken: string): Promise<TestResult> {
  const start = performance.now();
  try {
    const res = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const duration_ms = Math.round(performance.now() - start);

    if (res.ok) {
      const profile = await res.json();
      return {
        status: 'pass',
        message: `Authenticated as ${profile.email}`,
        duration_ms,
        details: { email: profile.email, name: profile.name },
      };
    }
    const err = await res.text();
    return { status: 'fail', message: `Token invalid (${res.status}): ${err}`, duration_ms };
  } catch (error) {
    return {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Connection test failed',
      duration_ms: Math.round(performance.now() - start),
    };
  }
}

async function testSendPermission(accessToken: string): Promise<TestResult> {
  const start = performance.now();
  try {
    const res = await fetch(`${GMAIL_API_URL}/drafts?maxResults=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const duration_ms = Math.round(performance.now() - start);

    if (res.ok) {
      return { status: 'pass', message: 'Send scope verified (can access drafts)', duration_ms };
    }
    if (res.status === 403) {
      return { status: 'fail', message: 'gmail.send scope not granted', duration_ms };
    }
    const err = await res.text();
    return { status: 'fail', message: `Unexpected error (${res.status}): ${err}`, duration_ms };
  } catch (error) {
    return {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Send permission test failed',
      duration_ms: Math.round(performance.now() - start),
    };
  }
}

async function testReadPermission(accessToken: string): Promise<TestResult> {
  const start = performance.now();
  try {
    const res = await fetch(`${GMAIL_API_URL}/messages?maxResults=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const duration_ms = Math.round(performance.now() - start);

    if (res.ok) {
      const data = await res.json();
      return {
        status: 'pass',
        message: `Read scope verified (${data.resultSizeEstimate ?? 0} estimated messages)`,
        duration_ms,
        details: { total_messages: data.resultSizeEstimate ?? 0 },
      };
    }
    if (res.status === 403) {
      return { status: 'fail', message: 'gmail.readonly scope not granted', duration_ms };
    }
    const err = await res.text();
    return { status: 'fail', message: `Unexpected error (${res.status}): ${err}`, duration_ms };
  } catch (error) {
    return {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Read permission test failed',
      duration_ms: Math.round(performance.now() - start),
    };
  }
}

async function sendTestEmail(accessToken: string, email: string): Promise<TestResult> {
  const start = performance.now();
  try {
    const mimeMessage = [
      'MIME-Version: 1.0',
      `From: ${email}`,
      `To: ${email}`,
      'Content-Type: text/html; charset=UTF-8',
      'Subject: GoodRev CRM - Gmail Connection Test',
      '',
      '<div style="font-family: sans-serif; padding: 20px;">',
      '<h2>Gmail Connection Test Successful</h2>',
      '<p>This is a test email from GoodRev CRM confirming your Gmail API connection is working correctly.</p>',
      `<p style="color: #666; font-size: 12px;">Sent at ${new Date().toISOString()}</p>`,
      '</div>',
    ].join('\r\n');

    const encodedMessage = Buffer.from(mimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch(`${GMAIL_API_URL}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });
    const duration_ms = Math.round(performance.now() - start);

    if (res.ok) {
      const result = await res.json();
      return {
        status: 'pass',
        message: `Test email sent to ${email}`,
        duration_ms,
        details: { message_id: result.id, thread_id: result.threadId },
      };
    }
    const err = await res.text();
    return { status: 'fail', message: `Failed to send: ${err}`, duration_ms };
  } catch (error) {
    return {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Send test email failed',
      duration_ms: Math.round(performance.now() - start),
    };
  }
}

// POST /api/gmail/test - Run Gmail API diagnostics
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = gmailTestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { connection_id, tests, send_test_email: shouldSendTestEmail } = parsed.data;

    // Fetch connection and verify ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    const { data: connection, error: connError } = await supabaseAny
      .from('gmail_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('user_id', user.id)
      .single();

    if (connError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const typedConnection = connection as GmailConnection;

    // Check if token needs refresh before tests
    const wasExpired = isTokenExpired(typedConnection.token_expires_at);

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(typedConnection);
    } catch {
      return NextResponse.json({
        results: {
          connection: { status: 'fail', message: 'Token refresh failed — please reconnect your Gmail account', duration_ms: 0 },
        },
        token_refreshed: false,
      });
    }

    // Run requested tests
    const results: Record<string, TestResult> = {};

    for (const test of tests) {
      switch (test) {
        case 'connection':
          results.connection = await testConnection(accessToken);
          break;
        case 'send_permission':
          results.send_permission = await testSendPermission(accessToken);
          break;
        case 'read_permission':
          results.read_permission = await testReadPermission(accessToken);
          break;
      }
    }

    if (shouldSendTestEmail) {
      results.send_test_email = await sendTestEmail(accessToken, typedConnection.email);
    }

    return NextResponse.json({
      results,
      token_refreshed: wasExpired,
    });
  } catch (error) {
    console.error('Error in POST /api/gmail/test:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
