import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import { listProducts, getProduct, createProduct, updateProduct, deleteProduct } from '@/lib/products/service';
import type { McpContext } from '@/types/mcp';

export function registerProductTools(server: McpServer, getContext: () => McpContext) {
  server.tool(
    'products.list',
    'List products/services in the catalog. Supports search and active/inactive filter.',
    {
      search: z.string().optional().describe('Search by name, SKU, or description'),
      is_active: z.boolean().optional().describe('Filter by active status'),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(50),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');
      const result = await listProducts(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        { search: params.search, is_active: params.is_active, page: params.page, limit: params.limit }
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'products.get',
    'Get a single product by ID.',
    {
      id: z.string().uuid().describe('Product ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');
      const result = await getProduct(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        params.id
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'products.create',
    'Create a new product or service in the catalog.',
    {
      name: z.string().min(1).max(200).describe('Product name'),
      description: z.string().max(2000).optional(),
      sku: z.string().max(50).optional(),
      default_price: z.number().min(0).optional(),
      unit_type: z.string().max(50).optional(),
      is_active: z.boolean().optional(),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');
      const result = await createProduct(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        params
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'products.update',
    'Update an existing product.',
    {
      id: z.string().uuid().describe('Product ID'),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      sku: z.string().max(50).optional(),
      default_price: z.number().min(0).optional(),
      unit_type: z.string().max(50).optional(),
      is_active: z.boolean().optional(),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');
      const { id, ...data } = params;
      const result = await updateProduct(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        id, data
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'products.delete',
    'Soft-delete a product from the catalog.',
    {
      id: z.string().uuid().describe('Product ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');
      await deleteProduct(
        { supabase: ctx.supabase, projectId: ctx.projectId, userId: ctx.userId },
        params.id
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }] };
    }
  );
}
