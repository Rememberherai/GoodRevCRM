import { z } from 'zod';
import { checkCommunityPermission, type CommunityAction, type CommunityResource } from '@/lib/projects/community-permissions';
import type { ToolDefinitionParam } from '@/lib/openrouter/client';
import type { McpContext } from '@/types/mcp';
import { extractReceiptData } from '@/lib/assistant/ocr';
import { createBill } from '@/lib/assistant/accounting-bridge';
import { createAdminClient } from '@/lib/supabase/admin';
import { createReceiptConfirmationSchema } from '@/lib/validators/community/receipts';
import { syncJobAssignment, syncProgramSession } from '@/lib/assistant/calendar-bridge';
import type { Database, Json } from '@/types/database';

type CommunityChatTool = {
  name: string;
  description: string;
  parameters: z.ZodObject<z.ZodRawShape>;
  resource: CommunityResource;
  action: CommunityAction;
  handler: (params: Record<string, unknown>, ctx: McpContext) => Promise<string>;
};

const tools: CommunityChatTool[] = [];

function defineCommunityTool(tool: CommunityChatTool) {
  tools.push(tool);
}

const receiptProcessSchema = z.object({
  storage_bucket: z.string().default('contracts'),
  storage_path: z.string().min(1).optional(),
  image_url: z.string().url().optional(),
  content_type: z.string().optional(),
  user_context: z.string().optional(),
});

const receiptConfirmSchema = z.object({
  vendor: z.string().min(1),
  amount: z.number().nonnegative(),
  receipt_date: z.string().min(1),
  description: z.string().nullable().optional(),
  account_code: z.string().nullable().optional(),
  class_name: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  storage_bucket: z.string().optional(),
  storage_path: z.string().optional(),
  content_type: z.string().optional(),
});

const calendarSyncProgramSchema = z.object({
  program_id: z.string().uuid(),
});

const calendarSyncJobSchema = z.object({
  job_id: z.string().uuid(),
});

defineCommunityTool({
  name: 'receipts.process_image',
  description: 'Extract vendor, amount, date, description, and likely coding details from an uploaded receipt image or PDF before asking the user to confirm.',
  resource: 'assistant_ap',
  action: 'view',
  parameters: receiptProcessSchema,
  handler: async (params, ctx) => {
    const parsed = receiptProcessSchema.parse(params);
    if (!parsed.storage_path && !parsed.image_url) {
      throw new Error('Either storage_path or image_url is required');
    }
    const admin = createAdminClient();
    const { data: project } = await admin
      .from('projects')
      .select('accounting_target')
      .eq('id', ctx.projectId)
      .single();

    const extraction = await extractReceiptData({
      projectId: ctx.projectId,
      storageBucket: parsed.storage_path ? parsed.storage_bucket : undefined,
      storagePath: parsed.storage_path,
      imageUrl: parsed.image_url,
      contentType: parsed.content_type,
      userContext: parsed.user_context,
    });

    const receiptDate = extraction.receipt_date ?? new Date().toISOString().slice(0, 10);
    return JSON.stringify({
      draft: {
        vendor: extraction.vendor ?? 'Unknown vendor',
        amount: extraction.amount ?? 0,
        receipt_date: receiptDate,
        description: extraction.description ?? parsed.user_context ?? null,
        account_code: extraction.account_code ?? null,
        class_name: extraction.class_name ?? null,
        accounting_target: project?.accounting_target ?? 'none',
        image_url: parsed.image_url ?? (parsed.storage_path ? `storage://${parsed.storage_bucket}/${parsed.storage_path}` : null),
        storage_bucket: parsed.storage_bucket,
        storage_path: parsed.storage_path ?? null,
        content_type: parsed.content_type ?? null,
        line_items: extraction.line_items,
      },
      status: 'pending_approval',
    });
  },
});

defineCommunityTool({
  name: 'receipts.confirm',
  description: 'Create a receipt confirmation record and execute bill creation only after the user has explicitly approved the extracted receipt details.',
  resource: 'assistant_ap',
  action: 'create',
  parameters: receiptConfirmSchema,
  handler: async (params, ctx) => {
    const parsed = receiptConfirmSchema.parse(params);
    if (!parsed.image_url && !parsed.storage_path) {
      throw new Error('A receipt image or uploaded storage path is required before confirmation');
    }
    const admin = createAdminClient();
    const { data: project } = await admin
      .from('projects')
      .select('accounting_target')
      .eq('id', ctx.projectId)
      .single();

    if (!project?.accounting_target || project.accounting_target === 'none') {
      throw new Error('This project does not have an accounting target configured yet');
    }

    const imageUrl = parsed.image_url
      ?? (parsed.storage_path && parsed.storage_bucket
        ? `storage://${parsed.storage_bucket}/${parsed.storage_path}`
        : null);

    if (!imageUrl) {
      throw new Error('A stored receipt image is required before confirmation');
    }

    const receiptInsert = createReceiptConfirmationSchema.parse({
      project_id: ctx.projectId,
      submitted_by: ctx.userId,
      vendor: parsed.vendor,
      amount: parsed.amount,
      receipt_date: parsed.receipt_date,
      description: parsed.description ?? null,
      account_code: parsed.account_code ?? null,
      class_name: parsed.class_name ?? null,
      ocr_raw: {
        storage_bucket: parsed.storage_bucket ?? null,
        storage_path: parsed.storage_path ?? null,
        content_type: parsed.content_type ?? null,
      },
      accounting_target: project.accounting_target === 'quickbooks' ? 'quickbooks' : 'goodrev',
      image_url: imageUrl,
      status: 'approved',
    });
    type ReceiptConfirmationInsert = Database['public']['Tables']['receipt_confirmations']['Insert'];
    const typedReceiptInsert: ReceiptConfirmationInsert = {
      project_id: ctx.projectId,
      submitted_by: ctx.userId,
      vendor: parsed.vendor,
      amount: parsed.amount,
      receipt_date: parsed.receipt_date,
      description: receiptInsert.description ?? null,
      account_code: receiptInsert.account_code ?? null,
      class_name: receiptInsert.class_name ?? null,
      ocr_raw: receiptInsert.ocr_raw as Json,
      accounting_target: receiptInsert.accounting_target,
      external_bill_id: null,
      status: 'approved',
      image_url: receiptInsert.image_url,
      error_message: null,
    };

    const { data: confirmation, error: insertError } = await admin
      .from('receipt_confirmations')
      .insert(typedReceiptInsert)
      .select('*')
      .single();

    if (insertError || !confirmation) {
      throw new Error(`Failed to save receipt confirmation: ${insertError?.message ?? 'unknown error'}`);
    }

    try {
      const result = await createBill({
        projectId: ctx.projectId,
        userId: ctx.userId,
        vendor: parsed.vendor,
        amount: parsed.amount,
        receiptDate: parsed.receipt_date,
        description: parsed.description ?? null,
        accountCode: parsed.account_code ?? null,
        className: parsed.class_name ?? null,
        imageUrl,
      });

      await admin
        .from('receipt_confirmations')
        .update({
          status: 'executed',
          external_bill_id: result.externalBillId,
          error_message: null,
        })
        .eq('id', confirmation.id);

      return JSON.stringify({
        receipt_confirmation_id: confirmation.id,
        status: 'executed',
        accounting_target: confirmation.accounting_target,
        external_bill_id: result.externalBillId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bill creation failed';
      await admin
        .from('receipt_confirmations')
        .update({
          status: 'failed',
          error_message: message,
        })
        .eq('id', confirmation.id);

      return JSON.stringify({
        receipt_confirmation_id: confirmation.id,
        status: 'failed',
        error: message,
      });
    }
  },
});

defineCommunityTool({
  name: 'calendar.sync_program',
  description: 'Push a structured community program session into a connected Google Calendar when concrete start and end times exist.',
  resource: 'programs',
  action: 'update',
  parameters: calendarSyncProgramSchema,
  handler: async (params) => {
    const parsed = calendarSyncProgramSchema.parse(params);
    const result = await syncProgramSession(parsed.program_id);
    return JSON.stringify(result);
  },
});

defineCommunityTool({
  name: 'calendar.sync_job',
  description: 'Push a structured job assignment into a connected Google Calendar when the job has both a desired start and deadline.',
  resource: 'jobs',
  action: 'update',
  parameters: calendarSyncJobSchema,
  handler: async (params) => {
    const parsed = calendarSyncJobSchema.parse(params);
    const result = await syncJobAssignment(parsed.job_id);
    return JSON.stringify(result);
  },
});

export function getCommunityToolDefinitions(): ToolDefinitionParam[] {
  return tools.map((tool) => {
    const schema = z.toJSONSchema(tool.parameters) as Record<string, unknown>;
    delete schema.$schema;

    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: schema,
      },
    };
  });
}

export async function executeCommunityTool(name: string, params: Record<string, unknown>, ctx: McpContext) {
  const tool = tools.find((item) => item.name === name);
  if (!tool) {
    throw new Error(`Unknown community tool: ${name}`);
  }

  if (!checkCommunityPermission(ctx.role, tool.resource, tool.action)) {
    throw new Error(`Missing community permission '${tool.resource}:${tool.action}'`);
  }

  return tool.handler(params, ctx);
}
