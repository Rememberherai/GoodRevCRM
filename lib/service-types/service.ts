import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  createServiceTypeSchema,
  updateServiceTypeSchema,
  type CreateServiceTypeInput,
  type UpdateServiceTypeInput,
} from '@/lib/validators/service-type';
import { emitAutomationEvent } from '@/lib/automations/engine';

type ServiceTypeRow = Database['public']['Tables']['service_types']['Row'];

interface ServiceContext {
  supabase: SupabaseClient<Database>;
  projectId: string;
  userId?: string;
}

export async function listServiceTypes(ctx: ServiceContext) {
  const { supabase, projectId } = ctx;

  const { data, error } = await supabase
    .from('service_types')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as ServiceTypeRow[];
}

export async function getServiceType(ctx: ServiceContext, serviceTypeId: string) {
  const { supabase, projectId } = ctx;

  const { data, error } = await supabase
    .from('service_types')
    .select('*')
    .eq('id', serviceTypeId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  return data as ServiceTypeRow;
}

export async function createServiceType(ctx: ServiceContext, input: CreateServiceTypeInput) {
  const { supabase, projectId, userId } = ctx;

  const parsed = createServiceTypeSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(', '));
  }

  const { data, error } = await supabase
    .from('service_types')
    .insert({
      project_id: projectId,
      created_by: userId ?? null,
      ...parsed.data,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`A service type named "${parsed.data.name}" already exists`);
    }
    throw error;
  }
  const serviceType = data as ServiceTypeRow;

  emitAutomationEvent({
    projectId,
    triggerType: 'entity.created',
    entityType: 'service_type',
    entityId: serviceType.id,
    data: serviceType as unknown as Record<string, unknown>,
  }).catch((e) => console.error('Automation event error:', e));

  return serviceType;
}

export async function updateServiceType(
  ctx: ServiceContext,
  serviceTypeId: string,
  input: UpdateServiceTypeInput
) {
  const { supabase, projectId } = ctx;

  const parsed = updateServiceTypeSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(', '));
  }

  const { data, error } = await supabase
    .from('service_types')
    .update(parsed.data)
    .eq('id', serviceTypeId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  const serviceType = data as ServiceTypeRow;

  emitAutomationEvent({
    projectId,
    triggerType: 'entity.updated',
    entityType: 'service_type',
    entityId: serviceType.id,
    data: serviceType as unknown as Record<string, unknown>,
  }).catch((e) => console.error('Automation event error:', e));

  return serviceType;
}

export async function deleteServiceType(ctx: ServiceContext, serviceTypeId: string) {
  const { supabase, projectId } = ctx;

  // Soft delete the service type
  const { data, error } = await supabase
    .from('service_types')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', serviceTypeId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  const serviceType = data as ServiceTypeRow;

  // Null out references on jobs
  await supabase
    .from('jobs')
    .update({ service_type_id: null })
    .eq('service_type_id', serviceTypeId);

  // Null out references on referrals
  await supabase
    .from('referrals')
    .update({ service_type_id: null })
    .eq('service_type_id', serviceTypeId);

  // Remove from contractor_scopes service_type_ids arrays via RPC or raw update
  // PostgreSQL: UPDATE contractor_scopes SET service_type_ids = array_remove(service_type_ids, id)
  // Supabase JS doesn't support array_remove, so we use rpc or handle it in batches
  const { data: scopes } = await supabase
    .from('contractor_scopes')
    .select('id, service_type_ids')
    .contains('service_type_ids', [serviceTypeId]);

  if (scopes && scopes.length > 0) {
    await Promise.all(
      scopes.map((scope) =>
        supabase
          .from('contractor_scopes')
          .update({
            service_type_ids: (scope.service_type_ids as string[]).filter(
              (id) => id !== serviceTypeId
            ),
          })
          .eq('id', scope.id)
      )
    );
  }

  emitAutomationEvent({
    projectId,
    triggerType: 'entity.deleted',
    entityType: 'service_type',
    entityId: serviceType.id,
    data: serviceType as unknown as Record<string, unknown>,
  }).catch((e) => console.error('Automation event error:', e));

  return serviceType;
}

export async function reorderServiceTypes(
  ctx: ServiceContext,
  items: Array<{ id: string; sort_order: number }>
) {
  const { supabase, projectId } = ctx;

  const updates = items.map((item) =>
    supabase
      .from('service_types')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
      .eq('project_id', projectId)
      .is('deleted_at', null)
  );

  await Promise.all(updates);
}
