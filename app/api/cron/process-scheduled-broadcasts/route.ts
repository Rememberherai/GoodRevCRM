import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendBroadcast } from '@/lib/community/broadcasts';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { verifyCronAuth } from '@/lib/scheduler/cron-auth';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

async function processScheduledBroadcasts(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}> {
  const admin = createAdminClient();
  const errors: string[] = [];
  let processed = 0;
  let sent = 0;
  let failed = 0;

  // Find broadcasts that are scheduled and due
  const { data: dueBroadcasts, error: queryError } = await admin
    .from('broadcasts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(10);

  if (queryError) {
    console.error('[Broadcast Cron] Query error:', queryError.message);
    return { processed: 0, sent: 0, failed: 0, errors: [queryError.message] };
  }

  if (!dueBroadcasts || dueBroadcasts.length === 0) {
    console.log('[Broadcast Cron] No scheduled broadcasts due.');
    return { processed: 0, sent: 0, failed: 0, errors: [] };
  }

  console.log(`[Broadcast Cron] Processing ${dueBroadcasts.length} scheduled broadcast(s)...`);

  for (const broadcast of dueBroadcasts) {
    processed++;

    // Mark as sending
    const { data: sendingRow, error: updateError } = await admin
      .from('broadcasts')
      .update({ status: 'sending' })
      .eq('id', broadcast.id)
      .eq('status', 'scheduled') // Optimistic lock: only update if still scheduled
      .select('*')
      .maybeSingle();

    if (updateError) {
      errors.push(`Broadcast ${broadcast.id}: failed to mark as sending — ${updateError.message}`);
      continue;
    }
    if (!sendingRow) {
      continue;
    }

    try {
      // Use the broadcast creator as the actor for Gmail connection lookup
      const actorUserId = sendingRow.created_by;
      if (!actorUserId) {
        throw new Error('Broadcast has no created_by user');
      }

      const result = await sendBroadcast(sendingRow, actorUserId);
      const finalStatus = result.failures.length > 0 ? 'failed' : 'sent';

      const { error: finalUpdateError } = await admin
        .from('broadcasts')
        .update({
          status: finalStatus,
          sent_at: finalStatus === 'sent' ? new Date().toISOString() : null,
          scheduled_at: null,
          failure_reason: result.failures.length > 0
            ? result.failures.join('\n').slice(0, 2000)
            : null,
        })
        .eq('id', broadcast.id);
      if (finalUpdateError) {
        throw finalUpdateError;
      }

      if (finalStatus === 'sent') {
        sent++;
      } else {
        failed++;
        errors.push(`Broadcast ${broadcast.id}: ${result.failures.length} failure(s)`);
      }

      emitAutomationEvent({
        projectId: sendingRow.project_id,
        triggerType: 'broadcast.sent' as never,
        entityType: 'broadcast',
        entityId: sendingRow.id,
        data: { broadcast_id: sendingRow.id, status: finalStatus, sent_count: result.sentCount },
      });

      console.log(`[Broadcast Cron] Broadcast ${sendingRow.id}: ${finalStatus} (${result.sentCount} sent, ${result.failures.length} failures)`);
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Broadcast ${broadcast.id}: ${message}`);

      const { error: failUpdateError } = await admin
        .from('broadcasts')
        .update({
          status: 'failed',
          sent_at: null,
          scheduled_at: null,
          failure_reason: message.slice(0, 2000),
        })
        .eq('id', broadcast.id);
      if (failUpdateError) {
        console.error(`[Broadcast Cron] Failed to persist error state for ${broadcast.id}:`, failUpdateError.message);
      }

      console.error(`[Broadcast Cron] Broadcast ${broadcast.id} error:`, message);
    }
  }

  return { processed, sent, failed, errors };
}

export async function GET(request: Request) {
  const hasCronAuth = await verifyCronAuth(request);

  if (hasCronAuth) {
    try {
      const result = await processScheduledBroadcasts();
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      console.error('[Broadcast Cron] Error:', error instanceof Error ? error.message : 'Unknown error');
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  }

  // Fall back to user session auth (for manual trigger)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processScheduledBroadcasts();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Broadcast Cron] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
