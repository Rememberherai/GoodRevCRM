import { z } from 'zod';
import { checkCommunityPermission, type CommunityAction, type CommunityResource } from '@/lib/projects/community-permissions';
import type { ToolDefinitionParam } from '@/lib/openrouter/client';
import type { McpContext } from '@/types/mcp';
import { extractReceiptData } from '@/lib/assistant/ocr';
import { createBill } from '@/lib/assistant/accounting-bridge';
import { createAdminClient } from '@/lib/supabase/admin';
import { createReceiptConfirmationSchema } from '@/lib/validators/community/receipts';
import { syncJobAssignment, syncProgramSession, syncGrantDeadline } from '@/lib/assistant/calendar-bridge';
import { checkContractorScopeMatch, formatWorkPlanLines } from '@/lib/community/jobs';
import { createProjectNotification } from '@/lib/community/notifications';
import { sendContractorDocuments, type ContractorDocumentKind } from '@/lib/community/contractor-documents';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { createHouseholdSchema, updateHouseholdSchema } from '@/lib/validators/community/households';
import {
  batchAttendanceSchema,
  createProgramSchema,
  programEnrollmentBaseSchema,
  updateProgramSchema,
} from '@/lib/validators/community/programs';
import {
  contributionBaseSchema,
} from '@/lib/validators/community/contributions';
import {
  createCommunityAssetSchema,
  updateCommunityAssetSchema,
} from '@/lib/validators/community/assets';
import {
  referralBaseSchema,
  updateReferralSchema,
} from '@/lib/validators/community/referrals';
import {
  relationshipBaseSchema,
} from '@/lib/validators/community/relationships';
import {
  createBroadcastSchema,
} from '@/lib/validators/community/broadcasts';
import {
  grantSchema,
} from '@/lib/validators/community/grants';
import { sendBroadcast } from '@/lib/community/broadcasts';
import type { ProjectRole } from '@/types/user';
import type { Database, Json } from '@/types/database';

export type CommunityChatTool = {
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

const paginatedListSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
});

const entityGetSchema = z.object({
  id: z.string().uuid(),
});

const householdsListSchema = paginatedListSchema;
const householdsCreateToolSchema = createHouseholdSchema.omit({
  project_id: true,
  members: true,
  intake: true,
});
const householdsUpdateToolSchema = updateHouseholdSchema.omit({
  project_id: true,
  members: true,
  intake: true,
}).extend({
  id: z.string().uuid(),
});

const programsListSchema = paginatedListSchema.extend({
  status: z.string().optional(),
});
const programsCreateToolSchema = createProgramSchema.omit({ project_id: true });
const programsUpdateToolSchema = updateProgramSchema.omit({ project_id: true }).extend({
  id: z.string().uuid(),
});
const programsEnrollToolSchema = programEnrollmentBaseSchema.extend({
  program_id: z.string().uuid(),
});
const programsAttendanceToolSchema = batchAttendanceSchema.extend({
  program_id: z.string().uuid(),
});

const contributionsListSchema = paginatedListSchema.extend({
  type: z.string().optional(),
  dimension_id: z.string().uuid().optional(),
  program_id: z.string().uuid().optional(),
});
const contributionsCreateToolSchema = contributionBaseSchema.omit({ project_id: true });
const contributionsUpdateToolSchema = contributionBaseSchema.partial().omit({ project_id: true }).extend({
  id: z.string().uuid(),
});

const assetsListSchema = paginatedListSchema.extend({
  category: z.string().optional(),
  condition: z.string().optional(),
});
const assetsCreateToolSchema = createCommunityAssetSchema.omit({ project_id: true });
const assetsUpdateToolSchema = updateCommunityAssetSchema.omit({ project_id: true }).extend({
  id: z.string().uuid(),
});

const referralsListSchema = z.object({
  status: z.string().optional(),
  household_id: z.string().uuid().optional(),
  person_id: z.string().uuid().optional(),
});
const referralsCreateToolSchema = referralBaseSchema.omit({ project_id: true });
const referralsUpdateToolSchema = updateReferralSchema.omit({ project_id: true }).extend({
  id: z.string().uuid(),
});

const relationshipsListSchema = z.object({
  person_id: z.string().uuid().optional(),
});
const relationshipsCreateToolSchema = relationshipBaseSchema.omit({ project_id: true });

const broadcastsCreateToolSchema = createBroadcastSchema.omit({ project_id: true });
const broadcastsSendToolSchema = z.object({
  id: z.string().uuid(),
});

const grantsListSchema = paginatedListSchema.extend({
  status: z.string().optional(),
  funder_organization_id: z.string().uuid().optional(),
});
const grantsCreateToolSchema = grantSchema.omit({ project_id: true });
const grantsUpdateToolSchema = grantSchema.partial().omit({ project_id: true }).extend({
  id: z.string().uuid(),
});
const grantDraftNarrativeSchema = z.object({
  grant_id: z.string().uuid(),
  focus_areas: z.array(z.string()).optional(),
});
const grantDraftBudgetSchema = z.object({
  grant_id: z.string().uuid(),
});
const calendarSyncGrantSchema = z.object({
  grant_id: z.string().uuid(),
  deadline_type: z.enum(['loi', 'application', 'report']),
});

function paginate(page: number, limit: number) {
  const offset = (page - 1) * limit;
  return { offset, to: offset + limit - 1 };
}

function deriveHouseholdGeocodedStatus(
  input: z.infer<typeof householdsCreateToolSchema> | z.infer<typeof householdsUpdateToolSchema>,
  mode: 'create' | 'update'
) {
  if (input.latitude !== null && input.latitude !== undefined && input.longitude !== null && input.longitude !== undefined) {
    return 'manual';
  }

  const touchedGeoFields = [
    input.address_street,
    input.address_city,
    input.address_state,
    input.address_postal_code,
    input.address_country,
    input.latitude,
    input.longitude,
    input.geocoded_status,
  ].some((value) => value !== undefined);

  if (mode === 'update' && !touchedGeoFields) {
    return undefined;
  }

  const hasAddress = [
    input.address_street,
    input.address_city,
    input.address_state,
    input.address_postal_code,
    input.address_country,
  ].some(Boolean);

  return hasAddress ? 'pending' : (mode === 'create' ? (input.geocoded_status ?? 'failed') : input.geocoded_status);
}

function deriveAssetGeocodedStatus(
  input: z.infer<typeof assetsCreateToolSchema> | z.infer<typeof assetsUpdateToolSchema>,
  mode: 'create' | 'update'
) {
  if (input.latitude !== null && input.latitude !== undefined && input.longitude !== null && input.longitude !== undefined) {
    return 'manual';
  }

  const touchedGeoFields = [
    input.address_street,
    input.address_city,
    input.address_state,
    input.address_postal_code,
    input.address_country,
    input.latitude,
    input.longitude,
    input.geocoded_status,
  ].some((value) => value !== undefined);

  if (mode === 'update' && !touchedGeoFields) {
    return undefined;
  }

  const hasAddress = [
    input.address_street,
    input.address_city,
    input.address_state,
    input.address_postal_code,
    input.address_country,
  ].some(Boolean);

  return hasAddress ? 'pending' : (mode === 'create' ? (input.geocoded_status ?? 'failed') : input.geocoded_status);
}

function communityError(message: string) {
  return new Error(message);
}

defineCommunityTool({
  name: 'households.list',
  description: 'List community households with optional search and pagination.',
  resource: 'households',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: householdsListSchema,
  handler: async (params, ctx) => {
    const parsed = householdsListSchema.parse(params);
    const admin = createAdminClient();
    const { offset, to } = paginate(parsed.page, parsed.limit);

    let query = admin
      .from('households')
      .select('id, name, address_city, address_state, household_size, updated_at', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(offset, to);

    if (parsed.search) {
      const sanitized = parsed.search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
      query = query.or(`name.ilike."%${sanitized}%",address_city.ilike."%${sanitized}%",address_state.ilike."%${sanitized}%"`);
    }

    const { data, error, count } = await query;
    if (error) throw communityError(`Failed to list households: ${error.message}`);
    return JSON.stringify({
      households: data ?? [],
      pagination: {
        page: parsed.page,
        limit: parsed.limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / parsed.limit),
      },
    });
  },
});

defineCommunityTool({
  name: 'households.get',
  description: 'Get a household and its linked members.',
  resource: 'households',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: entityGetSchema,
  handler: async (params, ctx) => {
    const parsed = entityGetSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('households')
      .select('*, household_members(*, person:people(id, first_name, last_name, email))')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.id)
      .is('deleted_at', null)
      .single();
    if (error || !data) throw communityError(`Household not found: ${error?.message ?? 'unknown error'}`);
    return JSON.stringify(data);
  },
});

defineCommunityTool({
  name: 'households.create',
  description: 'Create a new household record.',
  resource: 'households',
  action: 'create',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: householdsCreateToolSchema,
  handler: async (params, ctx) => {
    const parsed = householdsCreateToolSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('households')
      .insert({
        ...parsed,
        project_id: ctx.projectId,
        created_by: ctx.userId,
        geocoded_status: deriveHouseholdGeocodedStatus(parsed, 'create'),
        custom_fields: parsed.custom_fields as Json,
      })
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to create household: ${error?.message ?? 'unknown error'}`);

    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'household.created' as never,
      entityType: 'household',
      entityId: data.id,
      data: data as Record<string, unknown>,
    });

    return JSON.stringify({ household: data });
  },
});

defineCommunityTool({
  name: 'households.update',
  description: 'Update an existing household record.',
  resource: 'households',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: householdsUpdateToolSchema,
  handler: async (params, ctx) => {
    const parsed = householdsUpdateToolSchema.parse(params);
    const admin = createAdminClient();
    const { id, ...updates } = parsed;
    const geocodedStatus = deriveHouseholdGeocodedStatus(parsed, 'update');
    const { data, error } = await admin
      .from('households')
      .update({
        ...updates,
        ...(geocodedStatus !== undefined ? { geocoded_status: geocodedStatus } : {}),
        custom_fields: updates.custom_fields as Json | undefined,
      })
      .eq('project_id', ctx.projectId)
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to update household: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.updated',
      entityType: 'household',
      entityId: data.id,
      data: data as Record<string, unknown>,
    });
    return JSON.stringify({ household: data });
  },
});

defineCommunityTool({
  name: 'programs.list',
  description: 'List community programs with optional status filtering.',
  resource: 'programs',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: programsListSchema,
  handler: async (params, ctx) => {
    const parsed = programsListSchema.parse(params);
    const admin = createAdminClient();
    const { offset, to } = paginate(parsed.page, parsed.limit);
    let query = admin
      .from('programs')
      .select('id, name, status, start_date, end_date, requires_waiver, updated_at', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .order('updated_at', { ascending: false })
      .range(offset, to);

    if (parsed.search) {
      query = query.ilike('name', `%${parsed.search}%`);
    }
    if (parsed.status) {
      query = query.eq('status', parsed.status);
    }

    const { data, error, count } = await query;
    if (error) throw communityError(`Failed to list programs: ${error.message}`);
    return JSON.stringify({
      programs: data ?? [],
      pagination: {
        page: parsed.page,
        limit: parsed.limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / parsed.limit),
      },
    });
  },
});

defineCommunityTool({
  name: 'programs.get',
  description: 'Get a single community program record.',
  resource: 'programs',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: entityGetSchema,
  handler: async (params, ctx) => {
    const parsed = entityGetSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('programs')
      .select('*')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.id)
      .single();
    if (error || !data) throw communityError(`Program not found: ${error?.message ?? 'unknown error'}`);
    return JSON.stringify(data);
  },
});

defineCommunityTool({
  name: 'programs.create',
  description: 'Create a new community program.',
  resource: 'programs',
  action: 'create',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: programsCreateToolSchema,
  handler: async (params, ctx) => {
    const parsed = programsCreateToolSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('programs')
      .insert({
        ...parsed,
        project_id: ctx.projectId,
        target_dimensions: parsed.target_dimensions,
        schedule: parsed.schedule as Json | null | undefined,
      })
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to create program: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.created',
      entityType: 'program',
      entityId: data.id,
      data: data as Record<string, unknown>,
    });
    return JSON.stringify({ program: data });
  },
});

defineCommunityTool({
  name: 'programs.update',
  description: 'Update a community program.',
  resource: 'programs',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: programsUpdateToolSchema,
  handler: async (params, ctx) => {
    const parsed = programsUpdateToolSchema.parse(params);
    const admin = createAdminClient();
    const { id, ...updates } = parsed;
    const { data, error } = await admin
      .from('programs')
      .update({
        ...updates,
        schedule: updates.schedule as Json | null | undefined,
      })
      .eq('project_id', ctx.projectId)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to update program: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.updated',
      entityType: 'program',
      entityId: data.id,
      data: data as Record<string, unknown>,
    });
    return JSON.stringify({ program: data });
  },
});

defineCommunityTool({
  name: 'programs.enroll',
  description: 'Enroll a person or household into a program.',
  resource: 'programs',
  action: 'create',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: programsEnrollToolSchema,
  handler: async (params, ctx) => {
    const parsed = programsEnrollToolSchema.parse(params);
    const admin = createAdminClient();

    const { data: program, error: programError } = await admin
      .from('programs')
      .select('id, requires_waiver')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.program_id)
      .single();
    if (programError || !program) throw communityError(`Program not found: ${programError?.message ?? 'unknown error'}`);

    const requestedStatus = parsed.status ?? 'active';
    const { data, error } = await admin
      .from('program_enrollments')
      .insert({
        program_id: parsed.program_id,
        person_id: parsed.person_id ?? null,
        household_id: parsed.household_id ?? null,
        status: program.requires_waiver && requestedStatus === 'active' ? 'waitlisted' : requestedStatus,
        waiver_status: program.requires_waiver ? 'pending' : 'not_required',
        enrolled_at: parsed.enrolled_at ?? new Date().toISOString(),
        completed_at: parsed.completed_at ?? null,
        notes: parsed.notes ?? null,
      })
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to create enrollment: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'program.enrollment.created' as never,
      entityType: 'program_enrollment',
      entityId: data.id,
      data: data as Record<string, unknown>,
    });
    return JSON.stringify({ enrollment: data });
  },
});

defineCommunityTool({
  name: 'programs.record_attendance',
  description: 'Create or update a batch attendance set for a program date.',
  resource: 'programs',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: programsAttendanceToolSchema,
  handler: async (params, ctx) => {
    const parsed = programsAttendanceToolSchema.parse(params);
    const admin = createAdminClient();
    const entries = parsed.entries.map((entry) => ({
      program_id: parsed.program_id,
      person_id: entry.person_id,
      date: parsed.date,
      status: entry.status,
      hours: entry.hours ?? 0,
    }));
    const { data, error } = await admin
      .from('program_attendance')
      .upsert(entries, { onConflict: 'program_id,person_id,date' })
      .select('*');
    if (error) throw communityError(`Failed to save attendance: ${error.message}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'program.attendance.batch' as never,
      entityType: 'program_attendance',
      entityId: parsed.program_id,
      data: { program_id: parsed.program_id, date: parsed.date, count: data?.length ?? 0 },
    });
    return JSON.stringify({ attendance: data ?? [] });
  },
});

defineCommunityTool({
  name: 'contributions.list',
  description: 'List community contributions with optional filters.',
  resource: 'contributions',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: contributionsListSchema,
  handler: async (params, ctx) => {
    const parsed = contributionsListSchema.parse(params);
    const admin = createAdminClient();
    const { offset, to } = paginate(parsed.page, parsed.limit);
    let query = admin
      .from('contributions')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .order('date', { ascending: false })
      .range(offset, to);
    if (parsed.search) query = query.ilike('description', `%${parsed.search}%`);
    if (parsed.type) query = query.eq('type', parsed.type);
    if (parsed.dimension_id) query = query.eq('dimension_id', parsed.dimension_id);
    if (parsed.program_id) query = query.eq('program_id', parsed.program_id);
    const { data, error, count } = await query;
    if (error) throw communityError(`Failed to list contributions: ${error.message}`);
    return JSON.stringify({
      contributions: data ?? [],
      pagination: {
        page: parsed.page,
        limit: parsed.limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / parsed.limit),
      },
    });
  },
});

defineCommunityTool({
  name: 'contributions.get',
  description: 'Get a single community contribution.',
  resource: 'contributions',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: entityGetSchema,
  handler: async (params, ctx) => {
    const parsed = entityGetSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('contributions')
      .select('*')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.id)
      .single();
    if (error || !data) throw communityError(`Contribution not found: ${error?.message ?? 'unknown error'}`);
    return JSON.stringify(data);
  },
});

defineCommunityTool({
  name: 'contributions.create',
  description: 'Create a contribution record for money, goods, hours, grants, or services.',
  resource: 'contributions',
  action: 'create',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: contributionsCreateToolSchema,
  handler: async (params, ctx) => {
    const parsed = contributionsCreateToolSchema.parse(params);
    const admin = createAdminClient();
    let dimensionId = parsed.dimension_id ?? null;
    if (!dimensionId && parsed.program_id) {
      const { data: program } = await admin
        .from('programs')
        .select('target_dimensions')
        .eq('project_id', ctx.projectId)
        .eq('id', parsed.program_id)
        .single();
      dimensionId = Array.isArray(program?.target_dimensions) ? (program.target_dimensions[0] ?? null) : null;
    }
    const { data, error } = await admin
      .from('contributions')
      .insert({
        ...parsed,
        project_id: ctx.projectId,
        dimension_id: dimensionId,
      })
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to create contribution: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'contribution.created' as never,
      entityType: 'contribution',
      entityId: data.id,
      data: data as Record<string, unknown>,
    });
    return JSON.stringify({ contribution: data });
  },
});

defineCommunityTool({
  name: 'contributions.update',
  description: 'Update an existing contribution record.',
  resource: 'contributions',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: contributionsUpdateToolSchema,
  handler: async (params, ctx) => {
    const parsed = contributionsUpdateToolSchema.parse(params);
    const admin = createAdminClient();
    const { id, ...updates } = parsed;
    const { data, error } = await admin
      .from('contributions')
      .update(updates)
      .eq('project_id', ctx.projectId)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to update contribution: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.updated',
      entityType: 'contribution',
      entityId: data.id,
      data: data as Record<string, unknown>,
    });
    return JSON.stringify({ contribution: data });
  },
});

defineCommunityTool({
  name: 'assets.list',
  description: 'List community assets with optional category and condition filters.',
  resource: 'community_assets',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: assetsListSchema,
  handler: async (params, ctx) => {
    const parsed = assetsListSchema.parse(params);
    const admin = createAdminClient();
    const { offset, to } = paginate(parsed.page, parsed.limit);
    let query = admin
      .from('community_assets')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .order('updated_at', { ascending: false })
      .range(offset, to);
    if (parsed.category) query = query.eq('category', parsed.category);
    if (parsed.condition) query = query.eq('condition', parsed.condition);
    if (parsed.search) query = query.ilike('name', `%${parsed.search}%`);
    const { data, error, count } = await query;
    if (error) throw communityError(`Failed to list assets: ${error.message}`);
    return JSON.stringify({
      assets: data ?? [],
      pagination: {
        page: parsed.page,
        limit: parsed.limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / parsed.limit),
      },
    });
  },
});

defineCommunityTool({
  name: 'assets.get',
  description: 'Get a single community asset.',
  resource: 'community_assets',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: entityGetSchema,
  handler: async (params, ctx) => {
    const parsed = entityGetSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('community_assets')
      .select('*')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.id)
      .single();
    if (error || !data) throw communityError(`Asset not found: ${error?.message ?? 'unknown error'}`);
    return JSON.stringify(data);
  },
});

defineCommunityTool({
  name: 'assets.create',
  description: 'Create a community asset record.',
  resource: 'community_assets',
  action: 'create',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: assetsCreateToolSchema,
  handler: async (params, ctx) => {
    const parsed = assetsCreateToolSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('community_assets')
      .insert({
        ...parsed,
        project_id: ctx.projectId,
        geocoded_status: deriveAssetGeocodedStatus(parsed, 'create'),
      })
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to create asset: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.created',
      entityType: 'community_asset',
      entityId: data.id,
      data: data as Record<string, unknown>,
    });
    return JSON.stringify({ asset: data });
  },
});

defineCommunityTool({
  name: 'assets.update',
  description: 'Update a community asset.',
  resource: 'community_assets',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: assetsUpdateToolSchema,
  handler: async (params, ctx) => {
    const parsed = assetsUpdateToolSchema.parse(params);
    const admin = createAdminClient();
    const { id, ...updates } = parsed;
    const geocodedStatus = deriveAssetGeocodedStatus(parsed, 'update');
    const { data, error } = await admin
      .from('community_assets')
      .update({
        ...updates,
        ...(geocodedStatus !== undefined ? { geocoded_status: geocodedStatus } : {}),
      })
      .eq('project_id', ctx.projectId)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to update asset: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.updated',
      entityType: 'community_asset',
      entityId: data.id,
      data: data as Record<string, unknown>,
    });
    return JSON.stringify({ asset: data });
  },
});

defineCommunityTool({
  name: 'referrals.list',
  description: 'List community referrals with optional household, person, or status filters.',
  resource: 'referrals',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: referralsListSchema,
  handler: async (params, ctx) => {
    const parsed = referralsListSchema.parse(params);
    const admin = createAdminClient();
    let query = admin
      .from('referrals')
      .select('*')
      .eq('project_id', ctx.projectId)
      .order('updated_at', { ascending: false });
    if (parsed.status) query = query.eq('status', parsed.status);
    if (parsed.household_id) query = query.eq('household_id', parsed.household_id);
    if (parsed.person_id) query = query.eq('person_id', parsed.person_id);
    const { data, error } = await query;
    if (error) throw communityError(`Failed to list referrals: ${error.message}`);
    return JSON.stringify({ referrals: data ?? [] });
  },
});

defineCommunityTool({
  name: 'referrals.get',
  description: 'Get a single referral record.',
  resource: 'referrals',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: entityGetSchema,
  handler: async (params, ctx) => {
    const parsed = entityGetSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('referrals')
      .select('*')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.id)
      .single();
    if (error || !data) throw communityError(`Referral not found: ${error?.message ?? 'unknown error'}`);
    return JSON.stringify(data);
  },
});

defineCommunityTool({
  name: 'referrals.create',
  description: 'Create a new community referral.',
  resource: 'referrals',
  action: 'create',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: referralsCreateToolSchema,
  handler: async (params, ctx) => {
    const parsed = referralsCreateToolSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('referrals')
      .insert({
        ...parsed,
        project_id: ctx.projectId,
      })
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to create referral: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'referral.created' as never,
      entityType: 'referral' as never,
      entityId: data.id,
      data: data as Record<string, unknown>,
    });
    return JSON.stringify({ referral: data });
  },
});

defineCommunityTool({
  name: 'referrals.update',
  description: 'Update a referral and record completion status changes.',
  resource: 'referrals',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: referralsUpdateToolSchema,
  handler: async (params, ctx) => {
    const parsed = referralsUpdateToolSchema.parse(params);
    const admin = createAdminClient();
    const { id, ...updates } = parsed;
    const { data, error } = await admin
      .from('referrals')
      .update(updates)
      .eq('project_id', ctx.projectId)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to update referral: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: data.status === 'completed' ? ('referral.completed' as never) : 'entity.updated',
      entityType: 'referral' as never,
      entityId: data.id,
      data: data as Record<string, unknown>,
    });
    return JSON.stringify({ referral: data });
  },
});

defineCommunityTool({
  name: 'relationships.list',
  description: 'List relationships across people in the community project.',
  resource: 'relationships',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: relationshipsListSchema,
  handler: async (params, ctx) => {
    const parsed = relationshipsListSchema.parse(params);
    const admin = createAdminClient();
    let query = admin
      .from('relationships')
      .select('*')
      .eq('project_id', ctx.projectId)
      .order('updated_at', { ascending: false });
    if (parsed.person_id) {
      query = query.or(`person_a_id.eq.${parsed.person_id},person_b_id.eq.${parsed.person_id}`);
    }
    const { data, error } = await query;
    if (error) throw communityError(`Failed to list relationships: ${error.message}`);
    return JSON.stringify({ relationships: data ?? [] });
  },
});

defineCommunityTool({
  name: 'relationships.create',
  description: 'Create a relationship between two people in the community.',
  resource: 'relationships',
  action: 'create',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: relationshipsCreateToolSchema,
  handler: async (params, ctx) => {
    const parsed = relationshipsCreateToolSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('relationships')
      .insert({
        ...parsed,
        project_id: ctx.projectId,
      })
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to create relationship: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.created',
      entityType: 'relationship' as never,
      entityId: data.id,
      data: data as Record<string, unknown>,
    });
    return JSON.stringify({ relationship: data });
  },
});

defineCommunityTool({
  name: 'broadcasts.list',
  description: 'List community broadcasts and their send status.',
  resource: 'broadcasts',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: z.object({}),
  handler: async (_params, ctx) => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('broadcasts')
      .select('*')
      .eq('project_id', ctx.projectId)
      .order('updated_at', { ascending: false });
    if (error) throw communityError(`Failed to list broadcasts: ${error.message}`);
    return JSON.stringify({ broadcasts: data ?? [] });
  },
});

defineCommunityTool({
  name: 'broadcasts.create',
  description: 'Create a broadcast draft with audience filters and content.',
  resource: 'broadcasts',
  action: 'create',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: broadcastsCreateToolSchema,
  handler: async (params, ctx) => {
    const parsed = broadcastsCreateToolSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('broadcasts')
      .insert({
        ...parsed,
        project_id: ctx.projectId,
        created_by: ctx.userId,
        filter_criteria: parsed.filter_criteria as Json,
      })
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to create broadcast: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.created',
      entityType: 'broadcast',
      entityId: data.id,
      data: data as Record<string, unknown>,
    });
    return JSON.stringify({ broadcast: data });
  },
});

defineCommunityTool({
  name: 'broadcasts.send',
  description: 'Send an existing broadcast to its resolved recipients.',
  resource: 'broadcasts',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: broadcastsSendToolSchema,
  handler: async (params, ctx) => {
    const parsed = broadcastsSendToolSchema.parse(params);
    const admin = createAdminClient();
    const { data: broadcast, error: lookupError } = await admin
      .from('broadcasts')
      .select('*')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.id)
      .single();
    if (lookupError || !broadcast) throw communityError(`Broadcast not found: ${lookupError?.message ?? 'unknown error'}`);

    const result = await sendBroadcast(broadcast, ctx.userId);
    const status = result.failures.length > 0 ? 'failed' : 'sent';

    await admin
      .from('broadcasts')
      .update({
        status,
        sent_at: new Date().toISOString(),
        failure_reason: result.failures.length > 0 ? result.failures.join('\n').slice(0, 2000) : null,
      })
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.id);

    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'broadcast.sent' as never,
      entityType: 'broadcast',
      entityId: parsed.id,
      data: {
        broadcast_id: parsed.id,
        status,
        sent_count: result.sentCount,
        failure_count: result.failures.length,
      },
    });

    return JSON.stringify({
      broadcast_id: parsed.id,
      status,
      sent_count: result.sentCount,
      failure_count: result.failures.length,
      failures: result.failures,
    });
  },
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

      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'entity.created',
        entityType: 'receipt_confirmation',
        entityId: confirmation.id,
        data: { ...confirmation, status: 'executed', external_bill_id: result.externalBillId } as unknown as Record<string, unknown>,
      });

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

    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.created',
      entityType: 'contractor_scope',
      entityId: scope.id,
      data: scope as unknown as Record<string, unknown>,
    });

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

    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.updated',
      entityType: parsed.scope_id ? 'contractor_scope' : 'person',
      entityId: parsed.scope_id ?? parsed.contractor_id,
      data: { contractor_id: parsed.contractor_id, documents_sent: results.length, kinds: parsed.kinds },
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

    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'contractor.onboarded' as never,
      entityType: 'contractor_scope',
      entityId: scope.id,
      data: {
        ...scope,
        documents_sent: documents.length,
      } as Record<string, unknown>,
    });

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

    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'job.assigned' as never,
      entityType: 'job',
      entityId: job.id,
      data: job as Record<string, unknown>,
    });

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

    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.updated',
      entityType: 'job',
      entityId: job.id,
      data: job as unknown as Record<string, unknown>,
    });

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
  handler: async (params, _ctx) => {
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
  handler: async (params, _ctx) => {
    const parsed = calendarSyncJobSchema.parse(params);
    const result = await syncJobAssignment(parsed.job_id);
    return JSON.stringify(result);
  },
});

// ── Grant Management ──

defineCommunityTool({
  name: 'grants.list',
  description: 'List community grants with optional filters by status or funder.',
  resource: 'grants',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: grantsListSchema,
  handler: async (params, ctx) => {
    const parsed = grantsListSchema.parse(params);
    const admin = createAdminClient();
    const { offset, to } = paginate(parsed.page, parsed.limit);
    let query = admin
      .from('grants')
      .select('*, funder:organizations!grants_funder_organization_id_fkey(id, name)', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .order('updated_at', { ascending: false })
      .range(offset, to);
    if (parsed.search) query = query.or(`name.ilike.%${parsed.search}%,notes.ilike.%${parsed.search}%`);
    if (parsed.status) query = query.eq('status', parsed.status);
    if (parsed.funder_organization_id) query = query.eq('funder_organization_id', parsed.funder_organization_id);
    const { data, error, count } = await query;
    if (error) throw communityError(`Failed to list grants: ${error.message}`);
    return JSON.stringify({
      grants: data ?? [],
      pagination: { page: parsed.page, limit: parsed.limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / parsed.limit) },
    });
  },
});

defineCommunityTool({
  name: 'grants.get',
  description: 'Get a single grant record by ID.',
  resource: 'grants',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: entityGetSchema,
  handler: async (params, ctx) => {
    const parsed = entityGetSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('grants')
      .select('*, funder:organizations!grants_funder_organization_id_fkey(id, name), contact:people!grants_contact_person_id_fkey(id, first_name, last_name, email)')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.id)
      .single();
    if (error || !data) throw communityError(`Grant not found: ${error?.message ?? 'unknown error'}`);
    return JSON.stringify(data);
  },
});

defineCommunityTool({
  name: 'grants.create',
  description: 'Create a new grant record for tracking a funding opportunity through the pipeline.',
  resource: 'grants',
  action: 'create',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: grantsCreateToolSchema,
  handler: async (params, ctx) => {
    const parsed = grantsCreateToolSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('grants')
      .insert({ ...parsed, project_id: ctx.projectId })
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to create grant: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'grant.created' as never,
      entityType: 'grant' as never,
      entityId: data.id,
      data: data as unknown as Record<string, unknown>,
    });
    return JSON.stringify({ grant: data });
  },
});

defineCommunityTool({
  name: 'grants.update',
  description: 'Update an existing grant record (status, amounts, deadlines, notes).',
  resource: 'grants',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: grantsUpdateToolSchema,
  handler: async (params, ctx) => {
    const parsed = grantsUpdateToolSchema.parse(params);
    const { id, ...updates } = parsed;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('grants')
      .update(updates)
      .eq('project_id', ctx.projectId)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to update grant: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.updated',
      entityType: 'grant' as never,
      entityId: data.id,
      data: data as unknown as Record<string, unknown>,
    });
    return JSON.stringify({ grant: data });
  },
});

defineCommunityTool({
  name: 'grants.draft_narrative',
  description: 'Draft a grant narrative using real program data, attendance metrics, and impact dimensions from the project.',
  resource: 'grants',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: grantDraftNarrativeSchema,
  handler: async (params, ctx) => {
    const parsed = grantDraftNarrativeSchema.parse(params);
    const admin = createAdminClient();

    const { data: grant } = await admin
      .from('grants')
      .select('*, funder:organizations!grants_funder_organization_id_fkey(id, name)')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.grant_id)
      .single();
    if (!grant) throw communityError('Grant not found');

    const { data: programs } = await admin
      .from('programs')
      .select('id, name, description, status, capacity, target_dimensions')
      .eq('project_id', ctx.projectId)
      .in('status', ['active', 'completed']);

    const programIds = (programs ?? []).map((p) => p.id);
    const { data: enrollments } = programIds.length > 0
      ? await admin.from('program_enrollments').select('person_id, program_id').in('program_id', programIds)
      : { data: [] };
    const { data: attendance } = programIds.length > 0
      ? await admin.from('program_attendance').select('person_id, hours, program_id').in('program_id', programIds)
      : { data: [] };

    const { data: contributions } = await admin
      .from('contributions')
      .select('type, value, hours')
      .eq('project_id', ctx.projectId);

    const uniqueParticipants = new Set((enrollments ?? []).map((e) => e.person_id).filter(Boolean));
    const totalHours = (attendance ?? []).reduce((sum, a) => sum + (a.hours ?? 0), 0);
    const totalContribValue = (contributions ?? []).reduce((sum, c) => sum + (c.value ?? 0), 0);

    return JSON.stringify({
      grant: { name: grant.name, status: grant.status, amount_requested: grant.amount_requested, funder: grant.funder },
      programs: (programs ?? []).map((p) => ({ name: p.name, description: p.description, status: p.status, capacity: p.capacity })),
      metrics: {
        unduplicated_participants: uniqueParticipants.size,
        total_program_hours: Math.round(totalHours * 100) / 100,
        total_contribution_value: totalContribValue,
        program_count: (programs ?? []).length,
      },
      instruction: 'Use this data to draft a compelling grant narrative. Focus on impact, community need, and measurable outcomes.',
    });
  },
});

defineCommunityTool({
  name: 'grants.draft_budget',
  description: 'Pull actual program costs and contribution data to help draft a grant budget.',
  resource: 'grants',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: grantDraftBudgetSchema,
  handler: async (params, ctx) => {
    const parsed = grantDraftBudgetSchema.parse(params);
    const admin = createAdminClient();

    const { data: grant } = await admin
      .from('grants')
      .select('id, name, amount_requested, amount_awarded')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.grant_id)
      .single();
    if (!grant) throw communityError('Grant not found');

    const { data: contributions } = await admin
      .from('contributions')
      .select('type, description, value, hours, date, program:programs!contributions_program_id_fkey(name)')
      .eq('project_id', ctx.projectId)
      .order('date', { ascending: false })
      .limit(200);

    const byType: Record<string, { count: number; total_value: number; total_hours: number }> = {};
    for (const c of contributions ?? []) {
      const t = c.type ?? 'unknown';
      if (!byType[t]) byType[t] = { count: 0, total_value: 0, total_hours: 0 };
      byType[t].count++;
      byType[t].total_value += c.value ?? 0;
      byType[t].total_hours += c.hours ?? 0;
    }

    return JSON.stringify({
      grant: { name: grant.name, amount_requested: grant.amount_requested, amount_awarded: grant.amount_awarded },
      contribution_summary: byType,
      recent_contributions: (contributions ?? []).slice(0, 20),
      instruction: 'Use this financial data to draft a grant budget. Include line items, match amounts, and in-kind contributions.',
    });
  },
});

defineCommunityTool({
  name: 'calendar.sync_grant',
  description: 'Push a grant deadline (LOI, application, or report) to a connected Google Calendar.',
  resource: 'grants',
  action: 'update',
  roles: ['owner', 'admin', 'staff'],
  parameters: calendarSyncGrantSchema,
  handler: async (params, _ctx) => {
    const parsed = calendarSyncGrantSchema.parse(params);
    const admin = createAdminClient();
    const { data: grant } = await admin
      .from('grants')
      .select('loi_due_at, application_due_at, report_due_at')
      .eq('id', parsed.grant_id)
      .single();
    if (!grant) throw communityError('Grant not found');

    const dateMap: Record<string, string | null> = {
      loi: grant.loi_due_at,
      application: grant.application_due_at,
      report: grant.report_due_at,
    };
    const date = dateMap[parsed.deadline_type];
    if (!date) throw communityError(`No ${parsed.deadline_type} deadline set on this grant`);

    const dateStr = date.split('T')[0] ?? date;
    const result = await syncGrantDeadline(parsed.grant_id, parsed.deadline_type, dateStr);
    return JSON.stringify(result);
  },
});

// ──────────────── Service Types ────────────────

const serviceTypeSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.enum(['gray', 'blue', 'green', 'red', 'yellow', 'purple', 'orange', 'pink']).default('gray'),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
});

defineCommunityTool({
  name: 'service_types.list',
  description: 'List service types configured for the project (shared across jobs, contractors, and referrals)',
  parameters: z.object({}),
  resource: 'settings',
  action: 'view',
  handler: async (_params, ctx) => {
    const { data, error } = await ctx.supabase
      .from('service_types')
      .select('*')
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    if (error) throw communityError(`Failed to list service types: ${error.message}`);
    return JSON.stringify({ serviceTypes: data });
  },
});

defineCommunityTool({
  name: 'service_types.create',
  description: 'Create a new service type for categorizing jobs, contractors, and referrals',
  parameters: serviceTypeSchema,
  resource: 'settings',
  action: 'update',
  handler: async (params, ctx) => {
    const parsed = serviceTypeSchema.parse(params);
    const { data, error } = await ctx.supabase
      .from('service_types')
      .insert({
        ...parsed,
        project_id: ctx.projectId,
        created_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw communityError(`Failed to create service type: ${error.message}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.created',
      entityType: 'service_type',
      entityId: data.id,
      data: data as Record<string, unknown>,
    }).catch((e) => console.error('Automation event error:', e));
    return JSON.stringify(data);
  },
});

defineCommunityTool({
  name: 'service_types.update',
  description: 'Update an existing service type',
  parameters: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(50).optional(),
    color: z.enum(['gray', 'blue', 'green', 'red', 'yellow', 'purple', 'orange', 'pink']).optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
  }),
  resource: 'settings',
  action: 'update',
  handler: async (params, ctx) => {
    const { id, ...updates } = params as { id: string; [key: string]: unknown };
    const { data, error } = await ctx.supabase
      .from('service_types')
      .update(updates)
      .eq('id', id as string)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .select()
      .single();
    if (error) throw communityError(`Failed to update service type: ${error.message}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.updated',
      entityType: 'service_type',
      entityId: data.id,
      data: data as Record<string, unknown>,
    }).catch((e) => console.error('Automation event error:', e));
    return JSON.stringify(data);
  },
});

defineCommunityTool({
  name: 'service_types.delete',
  description: 'Delete a service type (soft delete). Records using it will have their service type cleared.',
  parameters: z.object({
    id: z.string().uuid(),
  }),
  resource: 'settings',
  action: 'update',
  handler: async (params, ctx) => {
    const { id } = params as { id: string };
    const { data, error } = await ctx.supabase
      .from('service_types')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('project_id', ctx.projectId)
      .is('deleted_at', null)
      .select()
      .single();
    if (error) throw communityError(`Failed to delete service type: ${error.message}`);
    // Null out references
    await ctx.supabase.from('jobs').update({ service_type_id: null }).eq('service_type_id', id);
    await ctx.supabase.from('referrals').update({ service_type_id: null }).eq('service_type_id', id);
    // Remove from contractor_scopes service_type_ids arrays
    const { data: scopes } = await ctx.supabase
      .from('contractor_scopes')
      .select('id, service_type_ids')
      .contains('service_type_ids', [id]);
    if (scopes && scopes.length > 0) {
      await Promise.all(
        scopes.map((scope) =>
          ctx.supabase
            .from('contractor_scopes')
            .update({
              service_type_ids: (scope.service_type_ids as string[]).filter(
                (stId) => stId !== id
              ),
            })
            .eq('id', scope.id)
        )
      );
    }
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.deleted',
      entityType: 'service_type',
      entityId: data.id,
      data: data as Record<string, unknown>,
    }).catch((e) => console.error('Automation event error:', e));
    return JSON.stringify({ success: true });
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

export function getCommunityToolCatalog(role?: ProjectRole): CommunityChatTool[] {
  return getAllowedTools(role);
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
