import { z } from 'zod';
import { checkCommunityPermission, type CommunityAction, type CommunityResource } from '@/lib/projects/community-permissions';
import type { ToolDefinitionParam } from '@/lib/openrouter/client';
import type { McpContext } from '@/types/mcp';
import { extractReceiptData } from '@/lib/assistant/ocr';
import { createBill } from '@/lib/assistant/accounting-bridge';
import { createAdminClient } from '@/lib/supabase/admin';
import { createReceiptConfirmationSchema } from '@/lib/validators/community/receipts';
import { syncJobAssignment, syncProgramSession } from '@/lib/assistant/calendar-bridge';
import { checkContractorScopeMatch, formatWorkPlanLines } from '@/lib/community/jobs';
import { createProjectNotification } from '@/lib/community/notifications';
import { sendContractorDocuments, type ContractorDocumentKind } from '@/lib/community/contractor-documents';
import type { ProjectRole } from '@/types/user';
import type { Database, Json } from '@/types/database';

type CommunityChatTool = {
  name: string;
  description: string;
  parameters: z.ZodObject<z.ZodRawShape>;
  resource: CommunityResource;
  action: CommunityAction;
  roles?: ProjectRole[];
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

const contractorScopeToolSchema = z.object({
  contractor_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  compensation_terms: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  service_categories: z.array(z.string().min(1)).default([]),
  certifications: z.array(z.string().min(1)).default([]),
  service_area_radius_miles: z.number().nonnegative().nullable().optional(),
  home_base_latitude: z.number().nullable().optional(),
  home_base_longitude: z.number().nullable().optional(),
});

const contractorSendDocumentsSchema = z.object({
  contractor_id: z.string().uuid(),
  scope_id: z.string().uuid().nullable().optional(),
  kinds: z.array(z.enum(['scope', 'w9', 'waiver', 'photo_release', 'policy'])).min(1),
});

const contractorOnboardSchema = contractorScopeToolSchema.extend({
  send_documents: z.boolean().default(true),
  kinds: z.array(z.enum(['scope', 'w9', 'waiver', 'photo_release', 'policy'])).default(['scope', 'w9', 'waiver', 'photo_release']),
});

const jobAssignSchema = z.object({
  contractor_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  desired_start: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  service_address: z.string().nullable().optional(),
  service_category: z.string().nullable().optional(),
  required_certifications: z.array(z.string().min(1)).default([]),
  service_latitude: z.number().nullable().optional(),
  service_longitude: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  allow_out_of_scope: z.boolean().default(false),
});

const jobPullSchema = z.object({
  job_id: z.string().uuid(),
});

const contractorJobsSchema = z.object({
  contractor_id: z.string().uuid().optional(),
  include_unassigned: z.boolean().default(false),
});

defineCommunityTool({
  name: 'receipts.process_image',
  description: 'Extract vendor, amount, date, description, and likely coding details from an uploaded receipt image or PDF before asking the user to confirm.',
  resource: 'assistant_ap',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
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
  roles: ['owner', 'admin', 'staff', 'case_manager'],
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
  name: 'contractors.create_scope',
  description: 'Draft a contractor scope of work record that can later be sent for signature.',
  resource: 'jobs',
  action: 'create',
  roles: ['owner', 'admin', 'staff'],
  parameters: contractorScopeToolSchema,
  handler: async (params, ctx) => {
    const parsed = contractorScopeToolSchema.parse(params);
    const admin = createAdminClient();
    const { data: scope, error } = await admin
      .from('contractor_scopes')
      .insert({
        project_id: ctx.projectId,
        contractor_id: parsed.contractor_id,
        created_by: ctx.userId,
        title: parsed.title,
        description: parsed.description ?? null,
        status: 'pending_signature',
        start_date: parsed.start_date ?? null,
        end_date: parsed.end_date ?? null,
        compensation_terms: parsed.compensation_terms ?? null,
        service_categories: parsed.service_categories,
        certifications: parsed.certifications,
        service_area_radius_miles: parsed.service_area_radius_miles ?? null,
        home_base_latitude: parsed.home_base_latitude ?? null,
        home_base_longitude: parsed.home_base_longitude ?? null,
      })
      .select('*')
      .single();

    if (error || !scope) {
      throw new Error(`Failed to create contractor scope: ${error?.message ?? 'unknown error'}`);
    }

    await admin
      .from('people')
      .update({ is_contractor: true })
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.contractor_id);

    return JSON.stringify({
      scope_id: scope.id,
      status: scope.status,
      title: scope.title,
    });
  },
});

defineCommunityTool({
  name: 'contractors.send_documents',
  description: 'Create and send contractor onboarding documents such as the scope, W9, waivers, and policy acknowledgements.',
  resource: 'jobs',
  action: 'update',
  roles: ['owner', 'admin', 'staff'],
  parameters: contractorSendDocumentsSchema,
  handler: async (params, ctx) => {
    const parsed = contractorSendDocumentsSchema.parse(params);
    const admin = createAdminClient();
    const results = await sendContractorDocuments({
      supabase: admin,
      adminClient: admin,
      projectId: ctx.projectId,
      contractorId: parsed.contractor_id,
      requestedBy: ctx.userId,
      scopeId: parsed.scope_id ?? null,
      kinds: parsed.kinds as ContractorDocumentKind[],
    });

    return JSON.stringify({ results });
  },
});

defineCommunityTool({
  name: 'contractors.onboard',
  description: 'Create a contractor scope of work and optionally send the onboarding documents in one workflow.',
  resource: 'jobs',
  action: 'create',
  roles: ['owner', 'admin', 'staff'],
  parameters: contractorOnboardSchema,
  handler: async (params, ctx) => {
    const parsed = contractorOnboardSchema.parse(params);
    const admin = createAdminClient();

    const { data: scope, error } = await admin
      .from('contractor_scopes')
      .insert({
        project_id: ctx.projectId,
        contractor_id: parsed.contractor_id,
        created_by: ctx.userId,
        title: parsed.title,
        description: parsed.description ?? null,
        status: 'pending_signature',
        start_date: parsed.start_date ?? null,
        end_date: parsed.end_date ?? null,
        compensation_terms: parsed.compensation_terms ?? null,
        service_categories: parsed.service_categories,
        certifications: parsed.certifications,
        service_area_radius_miles: parsed.service_area_radius_miles ?? null,
        home_base_latitude: parsed.home_base_latitude ?? null,
        home_base_longitude: parsed.home_base_longitude ?? null,
      })
      .select('*')
      .single();

    if (error || !scope) {
      throw new Error(`Failed to create contractor scope: ${error?.message ?? 'unknown error'}`);
    }

    await admin
      .from('people')
      .update({ is_contractor: true })
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.contractor_id);

    const documents = parsed.send_documents
      ? await sendContractorDocuments({
          supabase: admin,
          adminClient: admin,
          projectId: ctx.projectId,
          contractorId: parsed.contractor_id,
          requestedBy: ctx.userId,
          scopeId: scope.id,
          kinds: parsed.kinds as ContractorDocumentKind[],
        })
      : [];

    return JSON.stringify({
      scope_id: scope.id,
      scope_status: scope.status,
      documents,
    });
  },
});

defineCommunityTool({
  name: 'jobs.assign',
  description: 'Assign a new job to a contractor, check scope compatibility, notify the contractor, and sync to calendar when available.',
  resource: 'jobs',
  action: 'create',
  roles: ['owner', 'admin', 'staff'],
  parameters: jobAssignSchema,
  handler: async (params, ctx) => {
    const parsed = jobAssignSchema.parse(params);
    const admin = createAdminClient();

    let scopeId: string | null = null;
    let isOutOfScope = false;
    let scopeWarning: string | null = null;

    if (parsed.contractor_id) {
      const scopeMatch = await checkContractorScopeMatch(admin, ctx.projectId, parsed.contractor_id, {
        serviceCategory: parsed.service_category,
        requiredCertifications: parsed.required_certifications,
        serviceLatitude: parsed.service_latitude,
        serviceLongitude: parsed.service_longitude,
      });
      scopeId = scopeMatch.scopeId;

      if (!scopeMatch.matches) {
        if (!parsed.allow_out_of_scope) {
          throw new Error(scopeMatch.reason ?? 'This job falls outside the contractor scope of work.');
        }
        isOutOfScope = true;
        scopeWarning = scopeMatch.reason;
      }
    }

    const { data: job, error } = await admin
      .from('jobs')
      .insert({
        project_id: ctx.projectId,
        contractor_id: parsed.contractor_id ?? null,
        assigned_by: ctx.userId,
        scope_id: scopeId,
        title: parsed.title,
        description: parsed.description ?? null,
        status: 'assigned',
        priority: parsed.priority,
        desired_start: parsed.desired_start ?? null,
        deadline: parsed.deadline ?? null,
        service_address: parsed.service_address ?? null,
        service_category: parsed.service_category ?? null,
        required_certifications: parsed.required_certifications,
        service_latitude: parsed.service_latitude ?? null,
        service_longitude: parsed.service_longitude ?? null,
        is_out_of_scope: isOutOfScope,
        notes: parsed.notes ?? null,
      })
      .select('*, contractor:people!jobs_contractor_id_fkey(id, first_name, last_name, user_id)')
      .single();

    if (error || !job) {
      throw new Error(`Failed to assign job: ${error?.message ?? 'unknown error'}`);
    }

    if (job.contractor?.user_id) {
      await createProjectNotification({
        supabase: admin,
        userId: job.contractor.user_id,
        projectId: ctx.projectId,
        title: 'New job assigned',
        message: `You have a new job: ${job.title}`,
        entityType: 'job',
        entityId: job.id,
        actionUrl: null,
        priority: 'high',
      });
    }

    return JSON.stringify({
      job_id: job.id,
      status: job.status,
      scope_warning: scopeWarning,
    });
  },
});

defineCommunityTool({
  name: 'jobs.pull',
  description: 'Pull a job back from a contractor and mark it as pulled.',
  resource: 'jobs',
  action: 'delete',
  roles: ['owner', 'admin', 'staff'],
  parameters: jobPullSchema,
  handler: async (params, ctx) => {
    const parsed = jobPullSchema.parse(params);
    const admin = createAdminClient();

    const { data: job, error } = await admin
      .from('jobs')
      .update({
        status: 'pulled',
        pulled_at: new Date().toISOString(),
        contractor_id: null,
      })
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.job_id)
      .select('*')
      .single();

    if (error || !job) {
      throw new Error(`Failed to pull job: ${error?.message ?? 'unknown error'}`);
    }

    return JSON.stringify({ job_id: job.id, status: job.status });
  },
});

defineCommunityTool({
  name: 'jobs.list_for_contractor',
  description: 'List jobs assigned to a contractor, or open jobs they can take if explicitly requested.',
  resource: 'jobs',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'contractor'],
  parameters: contractorJobsSchema,
  handler: async (params, ctx) => {
    const parsed = contractorJobsSchema.parse(params);
    const admin = createAdminClient();

    let contractorId = parsed.contractor_id ?? null;
    if (!contractorId) {
      const { data: person } = await admin
        .from('people')
        .select('id')
        .eq('project_id', ctx.projectId)
        .eq('user_id', ctx.userId)
        .is('deleted_at', null)
        .maybeSingle();
      contractorId = person?.id ?? null;
    }

    let query = admin
      .from('jobs')
      .select('id, title, status, priority, desired_start, deadline, contractor_id')
      .eq('project_id', ctx.projectId)
      .order('created_at', { ascending: false });

    if (parsed.include_unassigned) {
      query = query.or(`contractor_id.eq.${contractorId},contractor_id.is.null`);
    } else if (contractorId) {
      query = query.eq('contractor_id', contractorId);
    } else {
      throw new Error('contractor_id is required when the current user is not linked to a contractor record.');
    }

    const { data: jobs, error } = await query;
    if (error) {
      throw new Error(`Failed to list contractor jobs: ${error.message}`);
    }

    return JSON.stringify({ jobs: jobs ?? [] });
  },
});

defineCommunityTool({
  name: 'jobs.my_jobs',
  description: 'List the current contractor user’s assigned and available jobs.',
  resource: 'jobs',
  action: 'view',
  roles: ['contractor'],
  parameters: z.object({}),
  handler: async (_params, ctx) => {
    const admin = createAdminClient();
    const { data: person } = await admin
      .from('people')
      .select('id')
      .eq('project_id', ctx.projectId)
      .eq('user_id', ctx.userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!person?.id) {
      throw new Error('Your contractor account is not linked to a person record yet.');
    }

    const { data: jobs, error } = await admin
      .from('jobs')
      .select('id, title, status, priority, desired_start, deadline, contractor_id')
      .eq('project_id', ctx.projectId)
      .or(`contractor_id.eq.${person.id},contractor_id.is.null`)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load your jobs: ${error.message}`);
    }

    return JSON.stringify({ jobs: jobs ?? [] });
  },
});

defineCommunityTool({
  name: 'jobs.my_calendar',
  description: 'Show the current contractor user’s upcoming accepted or in-progress jobs in chronological order.',
  resource: 'jobs',
  action: 'view',
  roles: ['contractor'],
  parameters: z.object({}),
  handler: async (_params, ctx) => {
    const admin = createAdminClient();
    const { data: person } = await admin
      .from('people')
      .select('id')
      .eq('project_id', ctx.projectId)
      .eq('user_id', ctx.userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!person?.id) {
      throw new Error('Your contractor account is not linked to a person record yet.');
    }

    const { data: jobs, error } = await admin
      .from('jobs')
      .select('id, title, status, desired_start, deadline, priority')
      .eq('project_id', ctx.projectId)
      .eq('contractor_id', person.id)
      .in('status', ['accepted', 'in_progress', 'paused', 'assigned'])
      .order('desired_start', { ascending: true, nullsFirst: false });

    if (error) {
      throw new Error(`Failed to load your calendar: ${error.message}`);
    }

    return JSON.stringify({ jobs: jobs ?? [] });
  },
});

defineCommunityTool({
  name: 'jobs.work_plan',
  description: 'Generate a suggested work plan for the current contractor user based on priority and deadlines.',
  resource: 'jobs',
  action: 'view',
  roles: ['contractor'],
  parameters: z.object({}),
  handler: async (_params, ctx) => {
    const admin = createAdminClient();
    const { data: person } = await admin
      .from('people')
      .select('id')
      .eq('project_id', ctx.projectId)
      .eq('user_id', ctx.userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!person?.id) {
      throw new Error('Your contractor account is not linked to a person record yet.');
    }

    const { data: jobs, error } = await admin
      .from('jobs')
      .select('id, title, status, priority, desired_start, deadline')
      .eq('project_id', ctx.projectId)
      .eq('contractor_id', person.id)
      .in('status', ['assigned', 'accepted', 'in_progress', 'paused'])
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to build your work plan: ${error.message}`);
    }

    return JSON.stringify({
      work_plan: formatWorkPlanLines(jobs ?? []),
    });
  },
});

defineCommunityTool({
  name: 'calendar.sync_program',
  description: 'Push a structured community program session into a connected Google Calendar when concrete start and end times exist.',
  resource: 'programs',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
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
  roles: ['owner', 'admin', 'staff'],
  parameters: calendarSyncJobSchema,
  handler: async (params) => {
    const parsed = calendarSyncJobSchema.parse(params);
    const result = await syncJobAssignment(parsed.job_id);
    return JSON.stringify(result);
  },
});

function getAllowedTools(role?: ProjectRole) {
  if (!role) return tools;
  return tools.filter((tool) => {
    if (tool.roles && !tool.roles.includes(role)) {
      return false;
    }
    return checkCommunityPermission(role, tool.resource, tool.action);
  });
}

export function getCommunityToolDefinitions(role?: ProjectRole): ToolDefinitionParam[] {
  return getAllowedTools(role).map((tool) => {
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
  const tool = getAllowedTools(ctx.role).find((item) => item.name === name);
  if (!tool) {
    throw new Error(`Unknown community tool: ${name}`);
  }

  if (!checkCommunityPermission(ctx.role, tool.resource, tool.action)) {
    throw new Error(`Missing community permission '${tool.resource}:${tool.action}'`);
  }

  return tool.handler(params, ctx);
}
