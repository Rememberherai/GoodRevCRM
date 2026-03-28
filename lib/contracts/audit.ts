import { createServiceClient } from '@/lib/supabase/server';
import type { ContractAuditAction, ContractAuditActorType } from '@/types/contract';

interface AuditEntry {
  project_id: string | null;
  document_id: string;
  recipient_id?: string | null;
  action: ContractAuditAction;
  actor_type: ContractAuditActorType;
  actor_id?: string | null;
  actor_name?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: Record<string, unknown> | null;
}

export async function insertAuditTrail(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('contract_audit_trail')
      .insert({
        project_id: entry.project_id,
        document_id: entry.document_id,
        recipient_id: entry.recipient_id ?? null,
        action: entry.action,
        actor_type: entry.actor_type,
        actor_id: entry.actor_id ?? null,
        actor_name: entry.actor_name ?? null,
        ip_address: entry.ip_address ?? null,
        user_agent: entry.user_agent ?? null,
        details: (entry.details as unknown as import('@/types/database').Json) ?? null,
      });

    if (error) {
      console.error('[CONTRACT_AUDIT] Failed to insert audit trail:', error.message);
    }
  } catch (err) {
    console.error('[CONTRACT_AUDIT] Unexpected error:', err);
  }
}

export async function insertAuditTrailBatch(entries: AuditEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('contract_audit_trail')
      .insert(entries.map((e) => ({
        project_id: e.project_id,
        document_id: e.document_id,
        recipient_id: e.recipient_id ?? null,
        action: e.action,
        actor_type: e.actor_type,
        actor_id: e.actor_id ?? null,
        actor_name: e.actor_name ?? null,
        ip_address: e.ip_address ?? null,
        user_agent: e.user_agent ?? null,
        details: (e.details as unknown as import('@/types/database').Json) ?? null,
      })));

    if (error) {
      console.error('[CONTRACT_AUDIT] Failed to insert batch audit trail:', error.message);
    }
  } catch (err) {
    console.error('[CONTRACT_AUDIT] Unexpected error:', err);
  }
}
