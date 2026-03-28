import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type ContractDocument = Database['public']['Tables']['contract_documents']['Row'];

/**
 * Verify that a user can access a specific document.
 * For project-scoped docs: RLS handles project membership.
 * For standalone docs: checks created_by === userId.
 */
export async function verifyDocumentAccess(
  supabase: SupabaseClient<Database>,
  documentId: string,
  userId: string
): Promise<{ document: ContractDocument | null; authorized: boolean }> {
  // RLS will filter — if we get a result, the user has access
  const { data: document } = await supabase
    .from('contract_documents')
    .select('*')
    .eq('id', documentId)
    .is('deleted_at', null)
    .single();

  if (!document) {
    return { document: null, authorized: false };
  }

  // Double-check standalone ownership at the application level
  if (document.project_id === null && document.created_by !== userId) {
    return { document: null, authorized: false };
  }

  return { document, authorized: true };
}

/**
 * Returns a Supabase query builder that fetches documents
 * the user can access: project-scoped (via membership) + standalone (via created_by).
 *
 * Uses the authenticated client so RLS handles the filtering.
 */
export function accessibleDocumentsQuery(supabase: SupabaseClient<Database>) {
  return supabase
    .from('contract_documents')
    .select('*, projects(name, slug), owner:users!contract_documents_owner_id_fkey(id, full_name, email)', { count: 'exact' })
    .is('deleted_at', null);
  // RLS handles the project membership check for project-scoped docs.
  // Standalone docs (project_id IS NULL) are included
  // only if created_by matches (enforced by RLS).
}
