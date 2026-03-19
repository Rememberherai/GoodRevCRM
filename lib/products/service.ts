import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createProductSchema, updateProductSchema, type CreateProductInput, type UpdateProductInput } from '@/lib/validators/product';
import { emitAutomationEvent } from '@/lib/automations/engine';

type ProductRow = Database['public']['Tables']['products']['Row'];

interface ServiceContext {
  supabase: SupabaseClient<Database>;
  projectId: string;
  userId?: string;
}

export async function listProducts(
  ctx: ServiceContext,
  opts: { search?: string; is_active?: boolean; page?: number; limit?: number }
) {
  const { supabase, projectId } = ctx;
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (opts.search) {
    const safe = opts.search.replace(/[%_\\]/g, '\\$&');
    query = query.or(`name.ilike.%${safe}%,sku.ilike.%${safe}%,description.ilike.%${safe}%`);
  }

  if (opts.is_active !== undefined) {
    query = query.eq('is_active', opts.is_active);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    products: data as ProductRow[],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  };
}

export async function getProduct(ctx: ServiceContext, productId: string) {
  const { supabase, projectId } = ctx;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  return data as ProductRow;
}

export async function createProduct(ctx: ServiceContext, input: CreateProductInput) {
  const { supabase, projectId, userId } = ctx;

  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map(i => i.message).join(', '));
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      project_id: projectId,
      created_by: userId ?? null,
      ...parsed.data,
    })
    .select()
    .single();

  if (error) throw error;
  const product = data as ProductRow;

  emitAutomationEvent({
    projectId,
    triggerType: 'entity.created',
    entityType: 'product',
    entityId: product.id,
    data: product as unknown as Record<string, unknown>,
  }).catch(e => console.error('Automation event error:', e));

  return product;
}

export async function updateProduct(ctx: ServiceContext, productId: string, input: UpdateProductInput) {
  const { supabase, projectId } = ctx;

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map(i => i.message).join(', '));
  }

  const { data, error } = await supabase
    .from('products')
    .update(parsed.data)
    .eq('id', productId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  const product = data as ProductRow;

  emitAutomationEvent({
    projectId,
    triggerType: 'entity.updated',
    entityType: 'product',
    entityId: product.id,
    data: product as unknown as Record<string, unknown>,
  }).catch(e => console.error('Automation event error:', e));

  return product;
}

export async function deleteProduct(ctx: ServiceContext, productId: string) {
  const { supabase, projectId } = ctx;

  const { data, error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  const product = data as ProductRow;

  emitAutomationEvent({
    projectId,
    triggerType: 'entity.deleted',
    entityType: 'product',
    entityId: product.id,
    data: product as unknown as Record<string, unknown>,
  }).catch(e => console.error('Automation event error:', e));

  return product;
}
