import type { SupabaseClient } from '@supabase/supabase-js';
import type { MergeConfig, MergeResult } from '@/types/deduplication';

/**
 * Perform an atomic merge operation using the database RPC function.
 * This ensures all related record reassignment happens in a single transaction.
 */
export async function performMerge(
  config: MergeConfig,
  supabase: SupabaseClient
): Promise<MergeResult> {
  const { data, error } = await supabase.rpc('perform_merge', {
    p_project_id: config.projectId,
    p_entity_type: config.entityType,
    p_survivor_id: config.survivorId,
    p_merged_ids: config.mergeIds,
    p_field_selections: config.fieldSelections,
    p_user_id: config.userId,
  });

  if (error) {
    console.error('Merge RPC error:', error);
    throw new Error(`Merge failed: ${error.message}`);
  }

  return data as MergeResult;
}
