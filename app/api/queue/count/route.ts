import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Returns the count of pending queue items:
 * - sequence enrollments that are active and due
 * - time-based automations that may need processing
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;

  // Count active enrollments that are due now
  const { count: sequenceCount } = await adminAny
    .from('sequence_enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .lte('next_send_at', new Date().toISOString());

  return NextResponse.json({
    pending: sequenceCount ?? 0,
  });
}
