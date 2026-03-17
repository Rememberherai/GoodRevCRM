import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkPermission } from '../auth';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { insertAuditTrail } from '@/lib/contracts/audit';
import type { McpContext } from '@/types/mcp';

export function registerContractTools(server: McpServer, getContext: () => McpContext) {
  // contracts.list
  server.tool(
    'contracts.list',
    'List contract documents with pagination and filtering',
    {
      page: z.number().int().min(1).default(1).describe('Page number'),
      limit: z.number().int().min(1).max(100).default(50).describe('Items per page'),
      search: z.string().optional().describe('Search by title'),
      status: z.string().optional().describe('Filter by status (draft, sent, completed, etc.)'),
      opportunity_id: z.string().uuid().optional().describe('Filter by opportunity'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { page, limit, search, status, opportunity_id } = params;
      const offset = (page - 1) * limit;

      let query = ctx.supabase
        .from('contract_documents')
        .select('*', { count: 'exact' })
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null);

      if (search) {
        const sanitized = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
        query = query.ilike('title', `%${sanitized}%`);
      }
      if (status) query = query.eq('status', status);
      if (opportunity_id) query = query.eq('opportunity_id', opportunity_id);

      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw new Error(`Failed to list contracts: ${error.message}`);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            contracts: data,
            pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
          }),
        }],
      };
    }
  );

  // contracts.get
  server.tool(
    'contracts.get',
    'Get a contract document by ID with recipients and fields',
    {
      id: z.string().uuid().describe('Contract document ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { data: doc, error } = await ctx.supabase
        .from('contract_documents')
        .select('*')
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .single();

      if (error) throw new Error(`Contract not found: ${error.message}`);

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

  // contracts.create
  server.tool(
    'contracts.create',
    'Create a new contract document (requires pre-uploaded PDF)',
    {
      title: z.string().min(1).describe('Document title'),
      original_file_path: z.string().describe('Storage path from upload'),
      original_file_name: z.string().describe('Original filename'),
      page_count: z.number().int().min(1).default(1).describe('Number of pages'),
      signing_order_type: z.enum(['sequential', 'parallel']).default('sequential'),
      opportunity_id: z.string().uuid().optional().describe('Link to opportunity'),
      organization_id: z.string().uuid().optional().describe('Link to organization'),
      person_id: z.string().uuid().optional().describe('Link to person'),
      description: z.string().optional(),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { data, error } = await ctx.supabase
        .from('contract_documents')
        .insert({
          ...params,
          project_id: ctx.projectId,
          created_by: ctx.userId,
          owner_id: ctx.userId,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create contract: ${error.message}`);

      insertAuditTrail({
        project_id: ctx.projectId,
        document_id: data.id,
        action: 'created',
        actor_type: 'user',
        actor_id: ctx.userId,
      });

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'entity.created',
        entityType: 'document' as never,
        entityId: data.id,
        data: data as unknown as Record<string, unknown>,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // contracts.add_recipient
  server.tool(
    'contracts.add_recipient',
    'Add a recipient (signer, CC, or witness) to a draft contract',
    {
      document_id: z.string().uuid().describe('Contract document ID'),
      name: z.string().min(1).describe('Recipient name'),
      email: z.string().email().describe('Recipient email'),
      role: z.enum(['signer', 'cc', 'witness']).default('signer'),
      signing_order: z.number().int().min(1).default(1),
      person_id: z.string().uuid().optional().describe('Link to CRM person'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      // Verify document is in draft
      const { data: doc } = await ctx.supabase
        .from('contract_documents')
        .select('status')
        .eq('id', params.document_id)
        .eq('project_id', ctx.projectId)
        .single();
      if (!doc) throw new Error('Document not found');
      if (doc.status !== 'draft') throw new Error('Can only add recipients to draft contracts');

      const { data, error } = await ctx.supabase
        .from('contract_recipients')
        .insert({
          project_id: ctx.projectId,
          document_id: params.document_id,
          name: params.name,
          email: params.email,
          role: params.role,
          signing_order: params.signing_order,
          person_id: params.person_id ?? null,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to add recipient: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // contracts.add_field
  server.tool(
    'contracts.add_field',
    'Add a field to a contract document (signature, text, checkbox, etc.)',
    {
      document_id: z.string().uuid().describe('Contract document ID'),
      recipient_id: z.string().uuid().describe('Recipient this field is assigned to'),
      field_type: z.enum([
        'signature', 'initials', 'date_signed', 'text_input',
        'checkbox', 'dropdown', 'name', 'email', 'company', 'title',
      ]).describe('Type of field'),
      page_number: z.number().int().min(1).default(1),
      x: z.number().min(0).max(100).describe('X position in percent'),
      y: z.number().min(0).max(100).describe('Y position in percent'),
      width: z.number().min(1).max(100).default(20).describe('Width in percent'),
      height: z.number().min(1).max(100).default(4).describe('Height in percent'),
      label: z.string().optional(),
      is_required: z.boolean().default(true),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { data: doc } = await ctx.supabase
        .from('contract_documents')
        .select('id, status')
        .eq('id', params.document_id)
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .single();
      if (!doc) throw new Error('Document not found in this project');
      if (doc.status !== 'draft') throw new Error('Can only add fields to draft documents');

      const { data, error } = await ctx.supabase
        .from('contract_fields')
        .insert({
          project_id: ctx.projectId,
          document_id: params.document_id,
          recipient_id: params.recipient_id,
          field_type: params.field_type,
          page_number: params.page_number,
          x: params.x,
          y: params.y,
          width: params.width,
          height: params.height,
          label: params.label ?? null,
          is_required: params.is_required,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to add field: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // contracts.void
  server.tool(
    'contracts.void',
    'Void an active contract document',
    {
      id: z.string().uuid().describe('Contract document ID'),
      reason: z.string().optional().describe('Reason for voiding'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'member');

      const { data: doc } = await ctx.supabase
        .from('contract_documents')
        .select('id, status, title')
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .single();

      if (!doc) throw new Error('Contract not found');

      const nonVoidable = ['draft', 'completed', 'voided'];
      if (nonVoidable.includes(doc.status)) {
        throw new Error(`Cannot void a ${doc.status} contract`);
      }

      const { error } = await ctx.supabase
        .from('contract_documents')
        .update({ status: 'voided', voided_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('project_id', ctx.projectId)
        .in('status', ['sent', 'viewed', 'partially_signed', 'expired', 'declined']);

      if (error) throw new Error(`Failed to void: ${error.message}`);

      insertAuditTrail({
        project_id: ctx.projectId,
        document_id: params.id,
        action: 'voided',
        actor_type: 'user',
        actor_id: ctx.userId,
        details: { reason: params.reason },
      });

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'document.voided' as never,
        entityType: 'document' as never,
        entityId: params.id,
        data: { title: doc.title },
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }] };
    }
  );

  // contracts.audit_trail
  server.tool(
    'contracts.audit_trail',
    'View the audit trail for a contract document',
    {
      document_id: z.string().uuid().describe('Contract document ID'),
    },
    async (params) => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { data, error } = await ctx.supabase
        .from('contract_audit_trail')
        .select('*')
        .eq('document_id', params.document_id)
        .eq('project_id', ctx.projectId)
        .order('created_at', { ascending: true });

      if (error) throw new Error(`Failed to fetch audit trail: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );

  // contracts.templates.list
  server.tool(
    'contracts.templates.list',
    'List contract templates',
    {},
    async () => {
      const ctx = getContext();
      checkPermission(ctx.role, 'viewer');

      const { data, error } = await ctx.supabase
        .from('contract_templates')
        .select('*')
        .eq('project_id', ctx.projectId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Failed to list templates: ${error.message}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    }
  );
}
