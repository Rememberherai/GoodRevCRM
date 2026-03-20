import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Supabase = SupabaseClient<Database>;

export async function createProjectNotification(params: {
  supabase: Supabase;
  userId: string | null | undefined;
  projectId: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  data?: Record<string, unknown>;
}) {
  if (!params.userId) return false;

  const { error } = await params.supabase.rpc('create_notification' as never, {
    p_user_id: params.userId,
    p_type: 'system',
    p_title: params.title,
    p_message: params.message,
    p_project_id: params.projectId,
    p_data: params.data ?? {},
    p_entity_type: params.entityType ?? null,
    p_entity_id: params.entityId ?? null,
    p_priority: params.priority ?? 'normal',
    p_action_url: params.actionUrl ?? null,
  } as never);

  if (error) {
    console.error('[COMMUNITY_NOTIFICATION] Failed to create notification:', error);
    return false;
  }

  return true;
}
