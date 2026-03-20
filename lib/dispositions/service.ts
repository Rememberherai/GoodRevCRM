import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { DispositionEntityType } from '@/types/disposition';
import {
  createDispositionSchema,
  updateDispositionSchema,
  type CreateDispositionInput,
  type UpdateDispositionInput,
} from '@/lib/validators/disposition';
import { emitAutomationEvent } from '@/lib/automations/engine';

type DispositionRow = Database['public']['Tables']['dispositions']['Row'];

interface ServiceContext {
  supabase: SupabaseClient<Database>;
  projectId: string;
  userId?: string;
}

export async function listDispositions(
  ctx: ServiceContext,
  opts: { entity_type: DispositionEntityType }
) {
  const { supabase, projectId } = ctx;

  const { data, error } = await supabase
    .from('dispositions')
    .select('*')
    .eq('project_id', projectId)
    .eq('entity_type', opts.entity_type)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as DispositionRow[];
}

export async function getDisposition(ctx: ServiceContext, dispositionId: string) {
  const { supabase, projectId } = ctx;

  const { data, error } = await supabase
    .from('dispositions')
    .select('*')
    .eq('id', dispositionId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  return data as DispositionRow;
}

export async function createDisposition(ctx: ServiceContext, input: CreateDispositionInput) {
  const { supabase, projectId, userId } = ctx;

  const parsed = createDispositionSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(', '));
  }

  // If this is being set as default, clear other defaults for same entity_type
  if (parsed.data.is_default) {
    await clearDefaults(supabase, projectId, parsed.data.entity_type);
  }

  const { data, error } = await supabase
    .from('dispositions')
    .insert({
      project_id: projectId,
      created_by: userId ?? null,
      ...parsed.data,
    })
    .select()
    .single();

  if (error) throw error;
  const disposition = data as DispositionRow;

  emitAutomationEvent({
    projectId,
    triggerType: 'entity.created',
    entityType: 'disposition',
    entityId: disposition.id,
    data: disposition as unknown as Record<string, unknown>,
  }).catch((e) => console.error('Automation event error:', e));

  return disposition;
}

export async function updateDisposition(
  ctx: ServiceContext,
  dispositionId: string,
  input: UpdateDispositionInput
) {
  const { supabase, projectId } = ctx;

  const parsed = updateDispositionSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(', '));
  }

  // If setting as default, first get entity_type and clear other defaults
  if (parsed.data.is_default) {
    const existing = await getDisposition(ctx, dispositionId);
    await clearDefaults(supabase, projectId, existing.entity_type as DispositionEntityType);
  }

  const { data, error } = await supabase
    .from('dispositions')
    .update(parsed.data)
    .eq('id', dispositionId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  const disposition = data as DispositionRow;

  emitAutomationEvent({
    projectId,
    triggerType: 'entity.updated',
    entityType: 'disposition',
    entityId: disposition.id,
    data: disposition as unknown as Record<string, unknown>,
  }).catch((e) => console.error('Automation event error:', e));

  return disposition;
}

export async function deleteDisposition(ctx: ServiceContext, dispositionId: string) {
  const { supabase, projectId } = ctx;

  // Get entity_type before deletion so we know which table to null out
  const existing = await getDisposition(ctx, dispositionId);
  const entityType = existing.entity_type as DispositionEntityType;

  // Soft delete the disposition
  const { data, error } = await supabase
    .from('dispositions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', dispositionId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  const disposition = data as DispositionRow;

  // Null out references on entities using this disposition
  const table = entityType === 'organization' ? 'organizations' : 'people';
  await supabase
    .from(table)
    .update({ disposition_id: null })
    .eq('disposition_id', dispositionId)
    .eq('project_id', projectId);

  emitAutomationEvent({
    projectId,
    triggerType: 'entity.deleted',
    entityType: 'disposition',
    entityId: disposition.id,
    data: disposition as unknown as Record<string, unknown>,
  }).catch((e) => console.error('Automation event error:', e));

  return disposition;
}

export async function reorderDispositions(
  ctx: ServiceContext,
  items: Array<{ id: string; sort_order: number }>
) {
  const { supabase, projectId } = ctx;

  // Update each item's sort_order
  const updates = items.map((item) =>
    supabase
      .from('dispositions')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
      .eq('project_id', projectId)
      .is('deleted_at', null)
  );

  await Promise.all(updates);
}

export async function getDefaultDisposition(
  ctx: ServiceContext,
  entityType: DispositionEntityType
): Promise<DispositionRow | null> {
  const { supabase, projectId } = ctx;

  const { data, error } = await supabase
    .from('dispositions')
    .select('*')
    .eq('project_id', projectId)
    .eq('entity_type', entityType)
    .eq('is_default', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data as DispositionRow | null;
}

async function clearDefaults(
  supabase: SupabaseClient<Database>,
  projectId: string,
  entityType: DispositionEntityType
) {
  await supabase
    .from('dispositions')
    .update({ is_default: false })
    .eq('project_id', projectId)
    .eq('entity_type', entityType)
    .eq('is_default', true)
    .is('deleted_at', null);
}
