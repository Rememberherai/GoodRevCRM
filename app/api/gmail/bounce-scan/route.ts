import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyCronAuth } from '@/lib/scheduler/cron-auth';
import { scanConnectionForBounces } from '@/lib/gmail/bounce-scan';

export const maxDuration = 60;

/**
 * POST /api/gmail/bounce-scan
 * Scan Gmail for bounce-back emails and mark corresponding enrollments as bounced.
 *
 * Body: { connection_id: string, dry_run?: boolean }
 */
export async function POST(request: Request) {
  const isCronAuth = await verifyCronAuth(request);

  let userId: string | null = null;

  if (!isCronAuth) {
    try {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: { connection_id?: string; dry_run?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.connection_id) {
    return NextResponse.json({ error: 'connection_id required' }, { status: 400 });
  }

  try {
    const result = await scanConnectionForBounces(body.connection_id, {
      dryRun: body.dry_run,
      userId: isCronAuth ? null : userId,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[BounceScan] Error:', error);
    return NextResponse.json({
      error: 'Bounce scan failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
