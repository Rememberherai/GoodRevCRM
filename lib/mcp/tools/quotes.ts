import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  acceptQuote,
  rejectQuote,
  setPrimaryQuote,
  addLineItem,
  updateLineItem,
  deleteLineItem,
} from '@/lib/quotes/service';
import type { McpContext } from '@/types/mcp';

export function registerQuoteTools(server: McpServer, getContext: () => McpContext) {
  server.tool(
    'quotes.list',
    'List quotes for an opportunity.',
    {
      opportunity_id: z.string().uuid().describe('Opportunity ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');
      const result = await listQuotes(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        params.opportunity_id
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'quotes.get',
    'Get a single quote with its line items.',
    {
      id: z.string().uuid().describe('Quote ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');
      const result = await getQuote(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        params.id
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'quotes.create',
    'Create a new quote on an opportunity. Currency is inherited from the opportunity.',
    {
      opportunity_id: z.string().uuid().describe('Opportunity ID'),
      title: z.string().min(1).max(200).describe('Quote title'),
      quote_number: z.string().max(50).optional(),
      valid_until: z.string().optional().describe('Expiration date (YYYY-MM-DD)'),
      notes: z.string().max(5000).optional(),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');
      const { opportunity_id, ...data } = params;
      const result = await createQuote(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        opportunity_id, data
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'quotes.update',
    'Update quote metadata. Status can only be set to "sent" (from draft) or "expired".',
    {
      id: z.string().uuid().describe('Quote ID'),
      title: z.string().min(1).max(200).optional(),
      quote_number: z.string().max(50).optional(),
      valid_until: z.string().optional(),
      notes: z.string().max(5000).optional(),
      status: z.enum(['sent', 'expired']).optional(),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');
      const { id, ...data } = params;
      const result = await updateQuote(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        id, data
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'quotes.delete',
    'Soft-delete a quote and its line items.',
    {
      id: z.string().uuid().describe('Quote ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');
      await deleteQuote(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        params.id
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }] };
    }
  );

  server.tool(
    'quotes.accept',
    'Accept a quote. Optionally sync the quote total to the opportunity amount. Auto-rejects other accepted quotes.',
    {
      id: z.string().uuid().describe('Quote ID'),
      sync_amount: z.boolean().optional().describe('Update opportunity deal value to match quote total'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');
      const result = await acceptQuote(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        params.id, { sync_amount: params.sync_amount ?? false }
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'quotes.reject',
    'Reject a quote. If the quote was primary, no auto-promotion occurs.',
    {
      id: z.string().uuid().describe('Quote ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');
      const result = await rejectQuote(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        params.id
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'quotes.set_primary',
    'Set a quote as the primary quote for its opportunity.',
    {
      id: z.string().uuid().describe('Quote ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');
      const result = await setPrimaryQuote(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        params.id
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'quotes.add_line_item',
    'Add a line item to a quote. Quote totals are recomputed automatically.',
    {
      quote_id: z.string().uuid().describe('Quote ID'),
      product_id: z.string().uuid().optional().describe('Product catalog ID (optional)'),
      name: z.string().min(1).max(200).describe('Line item name'),
      description: z.string().max(2000).optional(),
      quantity: z.number().min(0.01).max(999999).default(1),
      unit_price: z.number().min(0).default(0),
      discount_percent: z.number().min(0).max(100).default(0),
      sort_order: z.number().int().optional(),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');
      const { quote_id, ...data } = params;
      const result = await addLineItem(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        quote_id, data
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'quotes.update_line_item',
    'Update an existing line item on a quote.',
    {
      quote_id: z.string().uuid().describe('Quote ID'),
      item_id: z.string().uuid().describe('Line item ID'),
      product_id: z.string().uuid().nullable().optional(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).nullable().optional(),
      quantity: z.number().min(0.01).max(999999).optional(),
      unit_price: z.number().min(0).optional(),
      discount_percent: z.number().min(0).max(100).optional(),
      sort_order: z.number().int().optional(),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');
      const {
        quote_id,
        item_id,
        product_id,
        name,
        description,
        quantity,
        unit_price,
        discount_percent,
        sort_order,
      } = params;
      const result = await updateLineItem(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        quote_id,
        item_id,
        { product_id, name, description, quantity, unit_price, discount_percent, sort_order }
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'quotes.remove_line_item',
    'Remove a line item from a quote.',
    {
      quote_id: z.string().uuid().describe('Quote ID'),
      item_id: z.string().uuid().describe('Line item ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');
      await deleteLineItem(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        params.quote_id, params.item_id
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }] };
    }
  );
}
