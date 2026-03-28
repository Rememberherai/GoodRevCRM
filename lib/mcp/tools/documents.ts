import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { insertAuditTrail } from '@/lib/contracts/audit';
import type { McpContext } from '@/types/mcp';

/**
 * Standalone Documents MCP tools.
 *
 * MCP auth uses an admin Supabase client, so document access must be scoped
 * explicitly instead of relying on RLS. Accessible documents are either:
 * - project-scoped documents for ctx.projectId
 * - standalone documents created by ctx.userId
 */
function getAccessibleDocumentsFilter(ctx: McpContext): string {
  return `project_id.eq.${ctx.projectId},and(project_id.is.null,created_by.eq.${ctx.userId})`;
}

function canAccessDocument(
  ctx: McpContext,
  doc: { project_id: string | null; created_by: string | null }
): boolean {
  return doc.project_id === ctx.projectId || (doc.project_id === null && doc.created_by === ctx.userId);
}

export function registerDocumentTools(server: McpServer, getContext: () => McpContext) {
  // documents.list
  server.tool(
    'documents.list',
    'List standalone and project documents with pagination and filtering',
    {
      page: z.number().int().min(1).default(1).describe('Page number'),
      limit: z.number().int().min(1).max(100).default(50).describe('Items per page'),
      search: z.string().optional().describe('Search by title'),
      status: z.string().optional().describe('Filter by status (draft, sent, completed, etc.)'),
      standalone_only: z.boolean().optional().describe('Only show standalone documents (no project)'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { page, limit, search, status, standalone_only } = params;
      const offset = (page - 1) * limit;

      let query = ctx.supabase
        .from('contract_documents')
        .select('id, title, status, signing_order_type, original_file_name, project_id, created_at, sent_at, completed_at', { count: 'exact' })
        .is('deleted_at', null);

      if (standalone_only) {
        query = query.is('project_id', null).eq('created_by', ctx.userId);
      } else {
        query = query.or(getAccessibleDocumentsFilter(ctx));
      }

      if (search) {
        const sanitized = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
        query = query.ilike('title', `%${sanitized}%`);
      }
      if (status) query = query.eq('status', status);

      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw new Error(`Failed to list documents: ${error.message}`);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            documents: data,
            pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
          }),
        }],
      };
    }
  );

  // documents.get
  server.tool(
    'documents.get',
    'Get a standalone document by ID with recipients and fields',
    {
      id: z.string().uuid().describe('Document ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { data: doc, error } = await ctx.supabase
        .from('contract_documents')
        .select('*')
        .eq('id', params.id)
        .is('deleted_at', null)
        .single();

      if (error) throw new Error(`Document not found: ${error.message}`);
      if (!canAccessDocument(ctx, doc)) throw new Error('Document not found');

      const { data: recipients } = await ctx.supabase
        .from('contract_recipients')
        .select('*')
        .eq('document_id', params.id)
        .order('signing_order');

      const { data: fields } = await ctx.supabase
        .from('contract_fields')
        .select('*')
        .eq('document_id', params.id);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ...doc, recipients: recipients ?? [], fields: fields ?? [] }),
        }],
      };
    }
  );

  // documents.create
  server.tool(
    'documents.create',
    'Create a new standalone document (requires pre-uploaded PDF)',
    {
      title: z.string().min(1).describe('Document title'),
      original_file_path: z.string().describe('Storage path from upload'),
      original_file_name: z.string().describe('Original filename'),
      page_count: z.number().int().min(1).default(1).describe('Number of pages'),
      signing_order_type: z.enum(['sequential', 'parallel']).default('sequential'),
      description: z.string().optional(),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { data, error } = await ctx.supabase
        .from('contract_documents')
        .insert({
          ...params,
          project_id: null,
          created_by: ctx.userId,
          owner_id: ctx.userId,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create document: ${error.message}`);

      insertAuditTrail({
        project_id: null,
        document_id: data.id,
        action: 'created',
        actor_type: 'user',
        actor_id: ctx.userId,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // documents.void
  server.tool(
    'documents.void',
    'Void an active standalone document',
    {
      id: z.string().uuid().describe('Document ID'),
      reason: z.string().optional().describe('Reason for voiding'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { data: doc } = await ctx.supabase
        .from('contract_documents')
        .select('id, status, title, project_id, created_by')
        .eq('id', params.id)
        .is('deleted_at', null)
        .single();

      if (!doc) throw new Error('Document not found');
      if (!canAccessDocument(ctx, doc)) throw new Error('Document not found');

      const nonVoidable = ['draft', 'completed', 'voided'];
      if (nonVoidable.includes(doc.status)) {
        throw new Error(`Cannot void a ${doc.status} document`);
      }

      const { error } = await ctx.supabase
        .from('contract_documents')
        .update({ status: 'voided', voided_at: new Date().toISOString() })
        .eq('id', params.id)
        .in('status', ['sent', 'viewed', 'partially_signed', 'expired', 'declined']);

      if (error) throw new Error(`Failed to void: ${error.message}`);

      insertAuditTrail({
        project_id: doc.project_id,
        document_id: params.id,
        action: 'voided',
        actor_type: 'user',
        actor_id: ctx.userId,
        details: { reason: params.reason },
      });

      if (doc.project_id) {
        emitAutomationEvent({
          projectId: doc.project_id,
          triggerType: 'document.voided' as never,
          entityType: 'document' as never,
          entityId: params.id,
          data: { title: doc.title },
        });
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }] };
    }
  );

  // documents.audit_trail
  server.tool(
    'documents.audit_trail',
    'View the audit trail for a document',
    {
      document_id: z.string().uuid().describe('Document ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { data: doc, error: docError } = await ctx.supabase
        .from('contract_documents')
        .select('id, project_id, created_by')
        .eq('id', params.document_id)
        .is('deleted_at', null)
        .single();

      if (docError || !doc || !canAccessDocument(ctx, doc)) {
        throw new Error('Document not found');
      }

      const { data, error } = await ctx.supabase
        .from('contract_audit_trail')
        .select('*')
        .eq('document_id', params.document_id)
        .order('created_at', { ascending: true });

      if (error) throw new Error(`Failed to fetch audit trail: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // documents.templates.list
  server.tool(
    'documents.templates.list',
    'List document templates',
    {},
    async () => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      // Templates with null project_id are standalone templates
      const { data, error } = await ctx.supabase
        .from('contract_templates')
        .select('*')
        .is('deleted_at', null)
        .or(getAccessibleDocumentsFilter(ctx))
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Failed to list templates: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );
}
