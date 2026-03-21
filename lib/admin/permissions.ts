import { createAdminClient } from '@/lib/supabase/admin';
import type { NextRequest } from 'next/server';
import type { SystemAdminAction, AdminTargetType } from '@/types/admin';
import type { Json } from '@/types/database';

export class SystemAdminError extends Error {
  status: number;
  constructor(message = 'System admin access required', status = 403) {
    super(message);
    this.name = 'SystemAdminError';
    this.status = status;
  }
}

/**
 * Verifies the given user is a system admin.
 * Uses admin client to bypass RLS (the users table RLS
 * normally only lets users read their own row).
 * Throws SystemAdminError if not an admin.
 */
export async function requireSystemAdmin(userId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('users')
    .select('is_system_admin')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new SystemAdminError('User not found', 404);
  }

  if (!data.is_system_admin) {
    throw new SystemAdminError();
  }
}

/**
 * Logs an admin action to the system_admin_log table.
 * Fire-and-forget with error logging (same pattern as emitAutomationEvent).
 */
export async function logAdminAction(
  adminUserId: string,
  action: SystemAdminAction,
  targetType: AdminTargetType,
  targetId: string | null,
  details: Record<string, unknown>,
  request?: NextRequest
): Promise<void> {
  try {
    const supabase = createAdminClient();

    const ipAddress = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request?.headers.get('x-real-ip')
      ?? null;
    const userAgent = request?.headers.get('user-agent') ?? null;

    await supabase.from('system_admin_log').insert({
      admin_user_id: adminUserId,
      action,
      target_type: targetType,
      target_id: targetId,
      details: details as unknown as Json,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (err) {
    console.error('[system_admin_log] Failed to log admin action:', err);
  }
}
