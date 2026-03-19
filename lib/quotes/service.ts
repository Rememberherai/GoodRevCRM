import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { AcceptQuoteResult } from '@/types/quote';
import {
  createQuoteSchema,
  updateQuoteSchema,
  lineItemSchema,
  updateLineItemSchema,
  bulkLineItemsSchema,
  acceptQuoteSchema,
  type CreateQuoteInput,
  type UpdateQuoteInput,
  type LineItemInput,
  type UpdateLineItemInput,
  type AcceptQuoteInput,
} from '@/lib/validators/quote';
import { emitAutomationEvent } from '@/lib/automations/engine';

type QuoteRow = Database['public']['Tables']['quotes']['Row'];
type LineItemRow = Database['public']['Tables']['quote_line_items']['Row'];

interface ServiceContext {
  supabase: SupabaseClient<Database>;
  projectId: string;
  userId?: string;
}

function assertQuoteBelongsToOpportunity(
  quote: Pick<QuoteRow, 'opportunity_id'>,
  opportunityId?: string
) {
  if (opportunityId && quote.opportunity_id !== opportunityId) {
    throw new Error('Quote not found');
  }
}

function createServiceClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials for service client');
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getOpportunityStage(
  supabase: SupabaseClient<Database>,
  opportunityId: string,
  projectId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('stage')
    .eq('id', opportunityId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .single();
  if (error || !data) throw new Error('Opportunity not found');
  return data.stage;
}

function assertNotClosed(stage: string) {
  if (stage === 'closed_won' || stage === 'closed_lost') {
    throw new Error('Cannot modify quotes on a closed opportunity');
  }
}

function emitQuoteUpdated(projectId: string, quote: QuoteRow) {
  emitAutomationEvent({
    projectId,
    triggerType: 'entity.updated',
    entityType: 'quote',
    entityId: quote.id,
    data: quote as unknown as Record<string, unknown>,
  }).catch(e => console.error('Automation event error:', e));
}

// ============================================================
// Quotes CRUD
// ============================================================

export async function listQuotes(
  ctx: ServiceContext,
  opportunityId: string
) {
  const { supabase, projectId } = ctx;

  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('project_id', projectId)
    .eq('opportunity_id', opportunityId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as QuoteRow[];
}

export async function getQuote(
  ctx: ServiceContext,
  quoteId: string,
  opportunityId?: string
) {
  const { supabase, projectId } = ctx;

  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .single();
  if (qErr) throw qErr;
  assertQuoteBelongsToOpportunity(quote as QuoteRow, opportunityId);

  const { data: lineItems, error: liErr } = await supabase
    .from('quote_line_items')
    .select('*')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true });
  if (liErr) throw liErr;

  return {
    ...(quote as QuoteRow),
    line_items: (lineItems ?? []) as LineItemRow[],
  };
}

export async function createQuote(
  ctx: ServiceContext,
  opportunityId: string,
  input: CreateQuoteInput
) {
  const { supabase, projectId, userId } = ctx;

  const parsed = createQuoteSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map(i => i.message).join(', '));
  }

  // Verify opportunity exists and get its currency
  const { data: opp, error: oppErr } = await supabase
    .from('opportunities')
    .select('id, stage, currency')
    .eq('id', opportunityId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .single();
  if (oppErr || !opp) throw new Error('Opportunity not found');
  assertNotClosed(opp.stage);

  // Check if this is the first quote (auto-set primary)
  const { count } = await supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('opportunity_id', opportunityId)
    .is('deleted_at', null);
  const isFirst = (count ?? 0) === 0;

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      project_id: projectId,
      opportunity_id: opportunityId,
      currency: opp.currency ?? 'USD',
      is_primary: isFirst,
      created_by: userId ?? null,
      ...parsed.data,
    })
    .select()
    .single();

  if (error) throw error;
  const quote = data as QuoteRow;

  emitAutomationEvent({
    projectId,
    triggerType: 'entity.created',
    entityType: 'quote',
    entityId: quote.id,
    data: quote as unknown as Record<string, unknown>,
  }).catch(e => console.error('Automation event error:', e));

  return quote;
}

export async function updateQuote(
  ctx: ServiceContext,
  quoteId: string,
  input: UpdateQuoteInput,
  opportunityId?: string
) {
  const { supabase, projectId } = ctx;

  const parsed = updateQuoteSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map(i => i.message).join(', '));
  }

  // Fetch current quote to check state machine
  const { data: current, error: fetchErr } = await supabase
    .from('quotes')
    .select('status, opportunity_id')
    .eq('id', quoteId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .single();
  if (fetchErr || !current) throw new Error('Quote not found');
  assertQuoteBelongsToOpportunity(current as Pick<QuoteRow, 'opportunity_id'>, opportunityId);

  const stage = await getOpportunityStage(supabase, current.opportunity_id, projectId);
  assertNotClosed(stage);

  // Enforce status state machine
  const prevStatus = current.status;
  if (parsed.data.status) {
    if (parsed.data.status === 'sent' && prevStatus !== 'draft') {
      throw new Error('Can only mark a draft quote as sent');
    }
    // 'expired' is allowed from any status (no additional check)
  }

  const { data, error } = await supabase
    .from('quotes')
    .update(parsed.data)
    .eq('id', quoteId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  const quote = data as QuoteRow;

  emitAutomationEvent({
    projectId,
    triggerType: 'entity.updated',
    entityType: 'quote',
    entityId: quote.id,
    data: quote as unknown as Record<string, unknown>,
  }).catch(e => console.error('Automation event error:', e));

  // Emit status change if status actually changed
  if (parsed.data.status && parsed.data.status !== prevStatus) {
    emitAutomationEvent({
      projectId,
      triggerType: 'quote.status_changed',
      entityType: 'quote',
      entityId: quote.id,
      data: { ...quote as unknown as Record<string, unknown>, status: parsed.data.status },
      previousData: { status: prevStatus },
    }).catch(e => console.error('Automation event error:', e));
  }

  return quote;
}

export async function deleteQuote(
  ctx: ServiceContext,
  quoteId: string,
  opportunityId?: string
) {
  const { supabase, projectId } = ctx;

  const { data: current, error: fetchErr } = await supabase
    .from('quotes')
    .select('opportunity_id')
    .eq('id', quoteId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .single();
  if (fetchErr || !current) throw new Error('Quote not found');
  assertQuoteBelongsToOpportunity(current as Pick<QuoteRow, 'opportunity_id'>, opportunityId);

  const stage = await getOpportunityStage(supabase, current.opportunity_id, projectId);
  assertNotClosed(stage);

  const { data, error } = await supabase
    .from('quotes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', quoteId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  const quote = data as QuoteRow;

  emitAutomationEvent({
    projectId,
    triggerType: 'entity.deleted',
    entityType: 'quote',
    entityId: quote.id,
    data: quote as unknown as Record<string, unknown>,
  }).catch(e => console.error('Automation event error:', e));

  return quote;
}

// ============================================================
// Accept / Reject / Set Primary
// ============================================================

export async function acceptQuote(
  ctx: ServiceContext,
  quoteId: string,
  input: AcceptQuoteInput,
  opportunityId?: string
) {
  const parsed = acceptQuoteSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map(i => i.message).join(', '));
  }

  const quote = await getQuoteForLineItem(ctx.supabase, quoteId, ctx.projectId, opportunityId);

  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient.rpc('accept_quote', {
    p_quote_id: quoteId,
    p_project_id: ctx.projectId,
    p_sync_amount: parsed.data.sync_amount,
  });

  if (error) throw error;
  const result = data as unknown as AcceptQuoteResult;

  // Fetch the accepted quote for event data
  const { data: acceptedQuote } = await ctx.supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('project_id', ctx.projectId)
    .eq('opportunity_id', quote.opportunity_id)
    .is('deleted_at', null)
    .single();

  if (acceptedQuote) {
    const quoteData = acceptedQuote as unknown as Record<string, unknown>;
    emitQuoteUpdated(ctx.projectId, acceptedQuote as QuoteRow);

    // 1. quote.accepted event
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'quote.accepted',
      entityType: 'quote',
      entityId: quoteId,
      data: quoteData,
    }).catch(e => console.error('Automation event error:', e));

    // 2. quote.status_changed for the accepted quote
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'quote.status_changed',
      entityType: 'quote',
      entityId: quoteId,
      data: { ...quoteData, status: 'accepted' },
      previousData: { status: result.accepted_quote_prev_status },
    }).catch(e => console.error('Automation event error:', e));

    // 3. quote.status_changed for each auto-rejected quote
    const autoRejectedQuotes = result.auto_rejected_quote_ids.length > 0
      ? (
        await ctx.supabase
          .from('quotes')
          .select('*')
          .in('id', result.auto_rejected_quote_ids)
          .eq('project_id', ctx.projectId)
          .is('deleted_at', null)
      ).data
      : [];

    for (const rejectedId of result.auto_rejected_quote_ids) {
      const rejectedQuote = (autoRejectedQuotes ?? []).find((item) => item.id === rejectedId);
      if (rejectedQuote) {
        emitQuoteUpdated(ctx.projectId, rejectedQuote as QuoteRow);
      }
      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'quote.status_changed',
        entityType: 'quote',
        entityId: rejectedId,
        data: { status: 'rejected' },
        previousData: { status: 'accepted' },
      }).catch(e => console.error('Automation event error:', e));
    }
  }

  return result;
}

export async function rejectQuote(
  ctx: ServiceContext,
  quoteId: string,
  opportunityId?: string
) {
  const { supabase, projectId } = ctx;

  const { data: current, error: fetchErr } = await supabase
    .from('quotes')
    .select('status, opportunity_id, is_primary')
    .eq('id', quoteId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .single();
  if (fetchErr || !current) throw new Error('Quote not found');
  assertQuoteBelongsToOpportunity(current as Pick<QuoteRow, 'opportunity_id'>, opportunityId);

  const stage = await getOpportunityStage(supabase, current.opportunity_id, projectId);
  assertNotClosed(stage);

  const prevStatus = current.status;
  if (prevStatus === 'rejected' || prevStatus === 'expired') {
    throw new Error(`Cannot reject a ${prevStatus} quote`);
  }

  const { data, error } = await supabase
    .from('quotes')
    .update({ status: 'rejected' as const, is_primary: false })
    .eq('id', quoteId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  const quote = data as QuoteRow;
  emitQuoteUpdated(projectId, quote);

  emitAutomationEvent({
    projectId,
    triggerType: 'quote.status_changed',
    entityType: 'quote',
    entityId: quote.id,
    data: { ...quote as unknown as Record<string, unknown>, status: 'rejected' },
    previousData: { status: prevStatus },
  }).catch(e => console.error('Automation event error:', e));

  return quote;
}

export async function setPrimaryQuote(
  ctx: ServiceContext,
  quoteId: string,
  opportunityId?: string
) {
  const quote = await getQuoteForLineItem(ctx.supabase, quoteId, ctx.projectId, opportunityId);
  const { data: previousPrimary } = await ctx.supabase
    .from('quotes')
    .select('*')
    .eq('project_id', ctx.projectId)
    .eq('opportunity_id', quote.opportunity_id)
    .eq('is_primary', true)
    .neq('id', quoteId)
    .is('deleted_at', null)
    .maybeSingle();
  const serviceClient = createServiceClient();

  const { error } = await serviceClient.rpc('set_primary_quote', {
    p_quote_id: quoteId,
    p_project_id: ctx.projectId,
  });

  if (error) throw error;

  // Fetch updated quote
  const { data } = await ctx.supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('project_id', ctx.projectId)
    .eq('opportunity_id', quote.opportunity_id)
    .is('deleted_at', null)
    .single();

  const updatedQuote = data as QuoteRow;
  emitQuoteUpdated(ctx.projectId, updatedQuote);
  if (previousPrimary) {
    const { data: demotedQuote } = await ctx.supabase
      .from('quotes')
      .select('*')
      .eq('id', previousPrimary.id)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .maybeSingle();
    if (demotedQuote) {
      emitQuoteUpdated(ctx.projectId, demotedQuote as QuoteRow);
    }
  }

  return updatedQuote;
}

// ============================================================
// Line Items
// ============================================================

async function getQuoteForLineItem(
  supabase: SupabaseClient<Database>,
  quoteId: string,
  projectId: string,
  opportunityId?: string
): Promise<QuoteRow> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .single();
  if (error || !data) throw new Error('Quote not found');
  assertQuoteBelongsToOpportunity(data as QuoteRow, opportunityId);
  return data as QuoteRow;
}

export async function addLineItem(
  ctx: ServiceContext,
  quoteId: string,
  input: LineItemInput,
  opportunityId?: string
) {
  const { supabase, projectId } = ctx;

  const parsed = lineItemSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map(i => i.message).join(', '));
  }

  const quote = await getQuoteForLineItem(supabase, quoteId, projectId, opportunityId);
  const stage = await getOpportunityStage(supabase, quote.opportunity_id, projectId);
  assertNotClosed(stage);

  // Validate product belongs to same project (service-layer check)
  if (parsed.data.product_id) {
    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('id')
      .eq('id', parsed.data.product_id)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .single();
    if (pErr || !product) throw new Error('Product not found in this project');
  }

  const { data, error } = await supabase
    .from('quote_line_items')
    .insert({
      quote_id: quoteId,
      ...parsed.data,
    })
    .select()
    .single();

  if (error) throw error;
  const lineItem = data as LineItemRow;
  const { data: updatedQuote } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .single();
  if (updatedQuote) {
    emitQuoteUpdated(projectId, updatedQuote as QuoteRow);
  }
  return lineItem;
}

export async function updateLineItem(
  ctx: ServiceContext,
  quoteId: string,
  itemId: string,
  input: UpdateLineItemInput,
  opportunityId?: string
) {
  const { supabase, projectId } = ctx;

  const parsed = updateLineItemSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map(i => i.message).join(', '));
  }

  const quote = await getQuoteForLineItem(supabase, quoteId, projectId, opportunityId);
  const stage = await getOpportunityStage(supabase, quote.opportunity_id, projectId);
  assertNotClosed(stage);

  // Validate product if being changed
  if (parsed.data.product_id) {
    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('id')
      .eq('id', parsed.data.product_id)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .single();
    if (pErr || !product) throw new Error('Product not found in this project');
  }

  const { data, error } = await supabase
    .from('quote_line_items')
    .update(parsed.data)
    .eq('id', itemId)
    .eq('quote_id', quoteId)
    .select()
    .single();

  if (error) throw error;
  const lineItem = data as LineItemRow;
  const { data: updatedQuote } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .single();
  if (updatedQuote) {
    emitQuoteUpdated(projectId, updatedQuote as QuoteRow);
  }
  return lineItem;
}

export async function deleteLineItem(
  ctx: ServiceContext,
  quoteId: string,
  itemId: string,
  opportunityId?: string
) {
  const { supabase, projectId } = ctx;

  const quote = await getQuoteForLineItem(supabase, quoteId, projectId, opportunityId);
  const stage = await getOpportunityStage(supabase, quote.opportunity_id, projectId);
  assertNotClosed(stage);

  const { error } = await supabase
    .from('quote_line_items')
    .delete()
    .eq('id', itemId)
    .eq('quote_id', quoteId);

  if (error) throw error;
  const { data: updatedQuote } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .single();
  if (updatedQuote) {
    emitQuoteUpdated(projectId, updatedQuote as QuoteRow);
  }
}

export async function bulkReplaceLineItems(
  ctx: ServiceContext,
  quoteId: string,
  items: LineItemInput[],
  opportunityId?: string
) {
  const { supabase, projectId } = ctx;

  const parsed = bulkLineItemsSchema.safeParse(items);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map(i => i.message).join(', '));
  }

  const quote = await getQuoteForLineItem(supabase, quoteId, projectId, opportunityId);
  const stage = await getOpportunityStage(supabase, quote.opportunity_id, projectId);
  assertNotClosed(stage);

  // Validate all product_ids
  const productIds = parsed.data
    .map(i => i.product_id)
    .filter((id): id is string => !!id);
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .in('id', productIds)
      .eq('project_id', projectId)
      .is('deleted_at', null);
    const foundIds = new Set((products ?? []).map(p => p.id));
    for (const pid of productIds) {
      if (!foundIds.has(pid)) throw new Error(`Product ${pid} not found in this project`);
    }
  }

  const serviceClient = createServiceClient();
  const normalizedItems = parsed.data.map((item, idx) => ({
    ...item,
    sort_order: item.sort_order ?? idx,
  }));

  const { error } = await (serviceClient as SupabaseClient<Database> & {
    rpc(fn: 'replace_quote_line_items', args: {
      p_quote_id: string;
      p_project_id: string;
      p_items: Array<Record<string, unknown>>;
    }): Promise<{ error: Error | null }>;
  }).rpc('replace_quote_line_items', {
    p_quote_id: quoteId,
    p_project_id: projectId,
    p_items: normalizedItems as Array<Record<string, unknown>>,
  });
  if (error) throw error;

  // Return updated quote with line items
  const updatedQuote = await getQuote(ctx, quoteId, opportunityId);
  emitQuoteUpdated(projectId, updatedQuote);
  return updatedQuote;
}
