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
import { generateSlug } from '@/lib/validation-helpers';
import { bridgeCheckInToAttendance, promoteFromWaitlist } from '@/lib/events/service';
import { matchParsedNames } from '@/lib/events/scan-attendance';
import { generateSeriesInstances, syncFutureSeriesInstances, updateFutureInstances } from '@/lib/events/series';
import { sendEventCancellationConfirmation, sendWaitlistPromotionNotification } from '@/lib/events/notifications';
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
const grantDocumentsListSchema = z.object({
  grant_id: z.string().uuid(),
});
const grantDocumentUpdateSchema = z.object({
  grant_id: z.string().uuid(),
  document_id: z.string().uuid(),
  label: z.string().min(1).max(200).optional(),
  is_required: z.boolean().optional(),
  is_submitted: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
const grantSearchFederalSchema = z.object({
  keyword: z.string().min(1).describe('Search keywords for federal grant opportunities'),
  fundingCategories: z.string().optional().describe('Funding category code (e.g. "CD" for Community Development, "HL" for Health)'),
  eligibilities: z.string().optional().describe('Eligibility code (e.g. "25" for Nonprofits 501(c)(3))'),
  rows: z.number().int().min(1).max(50).default(15),
});
const grantImportFederalSchema = z.object({
  title: z.string().min(1),
  number: z.string().min(1),
  agencyCode: z.string().optional(),
  openDate: z.string().optional(),
  closeDate: z.string().optional(),
  oppStatus: z.string().optional(),
  id: z.string().optional(),
});
const grantReportsListSchema = z.object({
  grant_id: z.string().uuid(),
});
const grantReportCreateSchema = z.object({
  grant_id: z.string().uuid(),
  report_type: z.enum(['progress', 'financial', 'final', 'interim', 'annual', 'closeout', 'other']),
  title: z.string().min(1).max(200),
  due_date: z.string().min(1),
  notes: z.string().max(2000).nullable().optional(),
});
const grantReportUpdateSchema = z.object({
  grant_id: z.string().uuid(),
  report_id: z.string().uuid(),
  status: z.enum(['upcoming', 'in_progress', 'submitted', 'accepted', 'revision_requested']).optional(),
  title: z.string().min(1).max(200).optional(),
  due_date: z.string().optional(),
  document_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
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

// -- Program waiver tools --

const programWaiverListSchema = z.object({
  program_id: z.string().uuid(),
});

defineCommunityTool({
  name: 'programs.list_waivers',
  description: 'List waiver templates linked to a program.',
  resource: 'programs',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: programWaiverListSchema,
  handler: async (params, ctx) => {
    const parsed = programWaiverListSchema.parse(params);
    const admin = createAdminClient();

    const { data: program } = await admin
      .from('programs')
      .select('id')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.program_id)
      .single();
    if (!program) throw communityError('Program not found');

    const { data, error } = await admin
      .from('program_waivers')
      .select('id, template_id, created_at, contract_templates ( id, name, description, category )')
      .eq('program_id', parsed.program_id)
      .order('created_at', { ascending: true });
    if (error) throw communityError(`Failed to list waivers: ${error.message}`);
    return JSON.stringify({ waivers: data ?? [] });
  },
});

const programWaiverAddSchema = z.object({
  program_id: z.string().uuid(),
  template_id: z.string().uuid(),
});

defineCommunityTool({
  name: 'programs.add_waiver',
  description: 'Link a contract template as a required waiver for a program.',
  resource: 'programs',
  action: 'create',
  roles: ['owner', 'admin', 'staff'],
  parameters: programWaiverAddSchema,
  handler: async (params, ctx) => {
    const parsed = programWaiverAddSchema.parse(params);
    const admin = createAdminClient();

    const { data: program } = await admin
      .from('programs')
      .select('id')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.program_id)
      .single();
    if (!program) throw communityError('Program not found');

    const { data: template } = await admin
      .from('contract_templates')
      .select('id, name')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.template_id)
      .is('deleted_at', null)
      .single();
    if (!template) throw communityError('Contract template not found in this project');

    const { data, error } = await admin
      .from('program_waivers')
      .insert({ program_id: parsed.program_id, template_id: parsed.template_id })
      .select('id, template_id, created_at')
      .single();
    if (error) {
      if (error.code === '23505') throw communityError('This template is already linked to the program');
      throw communityError(`Failed to add waiver: ${error.message}`);
    }
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.created' as never,
      entityType: 'program_waiver' as never,
      entityId: data.id,
      data: { ...data, program_id: parsed.program_id, template_name: template.name },
    });
    return JSON.stringify({ waiver: data });
  },
});

const programWaiverRemoveSchema = z.object({
  program_waiver_id: z.string().uuid(),
});

defineCommunityTool({
  name: 'programs.remove_waiver',
  description: 'Remove a waiver template from a program.',
  resource: 'programs',
  action: 'delete',
  roles: ['owner', 'admin'],
  parameters: programWaiverRemoveSchema,
  handler: async (params, ctx) => {
    const parsed = programWaiverRemoveSchema.parse(params);
    const admin = createAdminClient();

    // Verify program_waiver belongs to this project
    const { data: pw } = await admin
      .from('program_waivers')
      .select('id, program_id, programs!inner( project_id )')
      .eq('id', parsed.program_waiver_id)
      .single();
    if (!pw || (pw.programs as unknown as { project_id: string }).project_id !== ctx.projectId) {
      throw communityError('Program waiver not found');
    }

    const { error } = await admin
      .from('program_waivers')
      .delete()
      .eq('id', parsed.program_waiver_id);
    if (error) throw communityError(`Failed to remove waiver: ${error.message}`);

    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.deleted' as never,
      entityType: 'program_waiver' as never,
      entityId: parsed.program_waiver_id,
      data: { id: parsed.program_waiver_id, program_id: pw.program_id },
    });
    return JSON.stringify({ success: true });
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
    if (parsed.search) {
      const sanitized = parsed.search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
      query = query.or(`name.ilike."%${sanitized}%",notes.ilike."%${sanitized}%"`);
    }
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
  description: 'Create a new grant record. Supports category (federal/state/corporate/foundation/individual), tier (1-3), mission_fit (1-5), urgency (low/medium/high/critical), funding_range_min/max, key_intel, recommended_strategy, and application_url.',
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
  description: 'Update an existing grant record (status, amounts, deadlines, category, tier, mission_fit, urgency, key_intel, recommended_strategy, application_url, notes, and post-award fields like award_number, award_period_start/end, total_award_amount, match_required, match_type, indirect_cost_rate, agreement_status, closeout_date).',
  resource: 'grants',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: grantsUpdateToolSchema,
  handler: async (params, ctx) => {
    const parsed = grantsUpdateToolSchema.parse(params);
    const { id, ...updates } = parsed;
    const admin = createAdminClient();

    // Fetch existing grant to detect status/agreement transitions and provide previousData
    const { data: existing } = await admin
      .from('grants')
      .select('*')
      .eq('project_id', ctx.projectId)
      .eq('id', id)
      .single();
    if (!existing) throw communityError('Grant not found');

    const { data, error } = await admin
      .from('grants')
      .update(updates)
      .eq('project_id', ctx.projectId)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to update grant: ${error?.message ?? 'unknown error'}`);

    // Detect agreement_status → executed
    if (updates.agreement_status === 'executed' && existing.agreement_status !== 'executed') {
      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'grant.agreement_executed' as never,
        entityType: 'grant' as never,
        entityId: data.id,
        data: data as unknown as Record<string, unknown>,
      });
    }

    // Detect status change
    const statusChanged = updates.status && updates.status !== existing.status;
    if (statusChanged) {
      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'grant.status_changed' as never,
        entityType: 'grant' as never,
        entityId: data.id,
        data: data as unknown as Record<string, unknown>,
        previousData: { status: existing.status },
      });
    }

    // Auto-create contribution when status transitions to 'awarded'
    if (statusChanged && updates.status === 'awarded' && data.amount_awarded != null) {
      await admin
        .from('contributions')
        .insert({
          project_id: ctx.projectId,
          type: 'grant',
          status: 'received',
          description: `Grant Award: ${data.name}`,
          value: data.amount_awarded,
          currency: 'USD',
          donor_organization_id: data.funder_organization_id,
          grant_id: data.id,
          date: new Date().toISOString().slice(0, 10),
        });
    }

    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.updated',
      entityType: 'grant' as never,
      entityId: data.id,
      data: data as unknown as Record<string, unknown>,
      previousData: existing as unknown as Record<string, unknown>,
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
  handler: async (params, ctx) => {
    const parsed = calendarSyncGrantSchema.parse(params);
    const admin = createAdminClient();
    const { data: grant } = await admin
      .from('grants')
      .select('loi_due_at, application_due_at, report_due_at')
      .eq('id', parsed.grant_id)
      .eq('project_id', ctx.projectId)
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

defineCommunityTool({
  name: 'grants.list_documents',
  description: 'List all documents attached to a grant (narratives, budgets, support letters, etc.).',
  resource: 'grants',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: grantDocumentsListSchema,
  handler: async (params, ctx) => {
    const parsed = grantDocumentsListSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('grant_documents')
      .select('*')
      .eq('project_id', ctx.projectId)
      .eq('grant_id', parsed.grant_id)
      .order('created_at', { ascending: false });
    if (error) throw communityError(`Failed to list grant documents: ${error.message}`);
    return JSON.stringify({ documents: data ?? [] });
  },
});

defineCommunityTool({
  name: 'grants.update_document',
  description: 'Update a grant document\'s metadata (label, required/submitted flags, notes).',
  resource: 'grants',
  action: 'update',
  roles: ['owner', 'admin', 'staff'],
  parameters: grantDocumentUpdateSchema,
  handler: async (params, ctx) => {
    const parsed = grantDocumentUpdateSchema.parse(params);
    const { grant_id, document_id, ...updates } = parsed;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('grant_documents')
      .update(updates)
      .eq('project_id', ctx.projectId)
      .eq('grant_id', grant_id)
      .eq('id', document_id)
      .select()
      .single();
    if (error || !data) throw communityError(`Failed to update document: ${error?.message ?? 'not found'}`);
    return JSON.stringify({ document: data });
  },
});

defineCommunityTool({
  name: 'grants.list_reports',
  description: 'List the report schedule for a grant (progress, financial, final reports with due dates and statuses).',
  resource: 'grants',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: grantReportsListSchema,
  handler: async (params, ctx) => {
    const parsed = grantReportsListSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('grant_report_schedules')
      .select('*')
      .eq('project_id', ctx.projectId)
      .eq('grant_id', parsed.grant_id)
      .order('due_date', { ascending: true });
    if (error) throw communityError(`Failed to list reports: ${error.message}`);
    return JSON.stringify({ reports: data ?? [] });
  },
});

defineCommunityTool({
  name: 'grants.create_report',
  description: 'Add a report to a grant\'s reporting schedule (e.g. quarterly progress report due on a specific date).',
  resource: 'grants',
  action: 'create',
  roles: ['owner', 'admin', 'staff'],
  parameters: grantReportCreateSchema,
  handler: async (params, ctx) => {
    const parsed = grantReportCreateSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('grant_report_schedules')
      .insert({
        grant_id: parsed.grant_id,
        project_id: ctx.projectId,
        report_type: parsed.report_type,
        title: parsed.title,
        due_date: parsed.due_date,
        status: 'upcoming',
        notes: parsed.notes ?? null,
      })
      .select()
      .single();
    if (error || !data) throw communityError(`Failed to create report: ${error?.message ?? 'unknown error'}`);
    return JSON.stringify({ report: data });
  },
});

defineCommunityTool({
  name: 'grants.update_report',
  description: 'Update a grant report\'s status, due date, or link a document to it.',
  resource: 'grants',
  action: 'update',
  roles: ['owner', 'admin', 'staff'],
  parameters: grantReportUpdateSchema,
  handler: async (params, ctx) => {
    const parsed = grantReportUpdateSchema.parse(params);
    const { grant_id, report_id, ...updates } = parsed;
    const admin = createAdminClient();

    // Auto-set submitted_at when marking as submitted
    const updateData: Record<string, unknown> = { ...updates };
    // Check existing status (scoped to project) for submitted_at auto-set
    const { data: existing } = await admin
      .from('grant_report_schedules')
      .select('status')
      .eq('id', report_id)
      .eq('project_id', ctx.projectId)
      .single();
    if (updates.status === 'submitted' && existing && existing.status !== 'submitted') {
      updateData.submitted_at = new Date().toISOString();
    }

    const { data, error } = await admin
      .from('grant_report_schedules')
      .update(updateData)
      .eq('project_id', ctx.projectId)
      .eq('grant_id', grant_id)
      .eq('id', report_id)
      .select()
      .single();
    if (error || !data) throw communityError(`Failed to update report: ${error?.message ?? 'not found'}`);

    if (updates.status === 'submitted' && existing && existing.status !== 'submitted') {
      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'grant.report_submitted' as never,
        entityType: 'grant' as never,
        entityId: grant_id,
        data: { report: data as unknown as Record<string, unknown>, grant_id },
      });
    }

    return JSON.stringify({ report: data });
  },
});

const grantContactAddSchema = z.object({
  grant_id: z.string().uuid().describe('The grant ID'),
  person_id: z.string().uuid().describe('The person ID to add as a contact'),
  role: z.string().max(200).nullable().optional().describe('Optional role (e.g. Program Officer, Internal Lead, Grants Writer)'),
  notes: z.string().max(2000).nullable().optional().describe('Optional notes about this contact relationship'),
});

const grantContactRemoveSchema = z.object({
  grant_id: z.string().uuid().describe('The grant ID'),
  contact_id: z.string().uuid().describe('The grant_contacts record ID to remove'),
});

defineCommunityTool({
  name: 'grants.list_contacts',
  description: 'List all contacts associated with a grant, including their roles.',
  resource: 'grants',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: entityGetSchema,
  handler: async (params, ctx) => {
    const parsed = entityGetSchema.parse(params);
    const admin = createAdminClient();

    // Verify grant belongs to project
    const { data: grant } = await admin
      .from('grants')
      .select('id')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.id)
      .single();
    if (!grant) throw communityError('Grant not found');

    const { data, error } = await admin
      .from('grant_contacts')
      .select('id, role, notes, created_at, person:people(id, first_name, last_name, email, title)')
      .eq('grant_id', parsed.id)
      .order('created_at', { ascending: true });
    if (error) throw communityError(`Failed to list contacts: ${error.message}`);

    return JSON.stringify({ contacts: data ?? [] });
  },
});

defineCommunityTool({
  name: 'grants.add_contact',
  description: 'Add a person as a contact on a grant with an optional role (e.g. Program Officer, Internal Lead, Co-Applicant, Board Sponsor, Fiscal Agent, Evaluator, Grants Writer, Legal / Compliance, Finance Contact).',
  resource: 'grants',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: grantContactAddSchema,
  handler: async (params, ctx) => {
    const parsed = grantContactAddSchema.parse(params);
    const admin = createAdminClient();

    // Verify grant belongs to project
    const { data: grant } = await admin
      .from('grants')
      .select('id')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.grant_id)
      .single();
    if (!grant) throw communityError('Grant not found');

    // Verify person belongs to project
    const { data: person } = await admin
      .from('people')
      .select('id')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.person_id)
      .single();
    if (!person) throw communityError('Person not found');

    const { data, error } = await admin
      .from('grant_contacts')
      .insert({ grant_id: parsed.grant_id, person_id: parsed.person_id, role: parsed.role ?? null, notes: parsed.notes ?? null })
      .select('id, role, notes, created_at, person:people(id, first_name, last_name, email, title)')
      .single();
    if (error) {
      if (error.code === '23505') throw communityError('This person is already a contact on this grant');
      throw communityError(`Failed to add contact: ${error.message}`);
    }
    return JSON.stringify({ contact: data });
  },
});

defineCommunityTool({
  name: 'grants.remove_contact',
  description: 'Remove a contact from a grant by the grant_contacts record ID.',
  resource: 'grants',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: grantContactRemoveSchema,
  handler: async (params, ctx) => {
    const parsed = grantContactRemoveSchema.parse(params);
    const admin = createAdminClient();

    // Verify grant belongs to project
    const { data: grant } = await admin
      .from('grants')
      .select('id')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.grant_id)
      .single();
    if (!grant) throw communityError('Grant not found');

    const { error } = await admin
      .from('grant_contacts')
      .delete()
      .eq('id', parsed.contact_id)
      .eq('grant_id', parsed.grant_id);
    if (error) throw communityError(`Failed to remove contact: ${error.message}`);

    return JSON.stringify({ success: true });
  },
});

defineCommunityTool({
  name: 'grants.search_federal',
  description: 'Search Grants.gov for federal funding opportunities by keyword, category, or eligibility type. Returns up to 15 results by default.',
  resource: 'grants',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: grantSearchFederalSchema,
  handler: async (params) => {
    const parsed = grantSearchFederalSchema.parse(params);
    const { searchGrantsGov } = await import('@/lib/community/grants-gov');
    const result = await searchGrantsGov({
      keyword: parsed.keyword,
      fundingCategories: parsed.fundingCategories,
      eligibilities: parsed.eligibilities,
      rows: parsed.rows,
    });
    return JSON.stringify({
      hitCount: result.hitCount,
      opportunities: result.opportunities.map(opp => ({
        ...opp,
        grants_gov_url: `https://www.grants.gov/search-results-detail/${opp.id}`,
      })),
    });
  },
});

defineCommunityTool({
  name: 'grants.import_federal',
  description: 'Import a federal opportunity from Grants.gov into the grant pipeline as a new grant in "researching" status.',
  resource: 'grants',
  action: 'create',
  roles: ['owner', 'admin', 'staff'],
  parameters: grantImportFederalSchema,
  handler: async (params, ctx) => {
    const parsed = grantImportFederalSchema.parse(params);
    const { mapOpportunityToGrant } = await import('@/lib/community/grants-gov');
    const grantData = mapOpportunityToGrant({
      id: parsed.id ?? '',
      number: parsed.number,
      title: parsed.title,
      agencyCode: parsed.agencyCode ?? '',
      openDate: parsed.openDate ?? '',
      closeDate: parsed.closeDate ?? '',
      oppStatus: parsed.oppStatus ?? '',
    });
    const admin = createAdminClient();

    // Check for duplicate import
    if (grantData.funder_grant_id) {
      const { data: existing } = await admin
        .from('grants')
        .select('id, name')
        .eq('project_id', ctx.projectId)
        .eq('funder_grant_id', grantData.funder_grant_id)
        .maybeSingle();
      if (existing) {
        throw communityError(`This opportunity has already been imported as "${existing.name}"`);
      }
    }

    const { data, error } = await admin
      .from('grants')
      .insert({ ...grantData, project_id: ctx.projectId })
      .select()
      .single();
    if (error || !data) throw communityError(`Failed to import: ${error?.message ?? 'unknown error'}`);
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

// --- Census Household Lookup ---

defineCommunityTool({
  name: 'census.lookup_households',
  description: 'Look up the total number of households in a service area using the US Census Bureau API. Supports municipality (city + state) or ZIP code lookups.',
  resource: 'households',
  action: 'view',
  roles: ['owner', 'admin'],
  parameters: z.object({
    type: z.enum(['municipality', 'zip_codes']).describe('Lookup type: municipality for city/state, zip_codes for ZIP codes'),
    municipalities: z.array(z.object({
      city: z.string().min(1),
      state: z.string().min(2).max(2),
    })).optional().describe('List of municipalities (required when type is municipality)'),
    zip_codes: z.array(z.string().regex(/^\d{5}$/)).optional().describe('List of 5-digit ZIP codes (required when type is zip_codes)'),
  }),
  handler: async (params, ctx) => {
    const { type, municipalities, zip_codes } = params as {
      type: 'municipality' | 'zip_codes';
      municipalities?: Array<{ city: string; state: string }>;
      zip_codes?: string[];
    };

    const { fetchHouseholdsByPlaces, fetchHouseholdsByZipCodes } = await import('@/lib/enrichment/census-households');

    if (type === 'municipality') {
      if (!municipalities || municipalities.length === 0) {
        return JSON.stringify({ error: 'At least one municipality is required' });
      }
      const results = await fetchHouseholdsByPlaces(municipalities, ctx.projectId);
      const total = results.reduce((sum, r) => sum + r.households, 0);
      return JSON.stringify({ results, total });
    }

    if (!zip_codes || zip_codes.length === 0) {
      return JSON.stringify({ error: 'At least one ZIP code is required' });
    }
    const results = await fetchHouseholdsByZipCodes(zip_codes, ctx.projectId);
    const total = results.reduce((sum, r) => sum + r.households, 0);
    return JSON.stringify({ results, total });
  },
});

// ── Event tool schemas ──────────────────────────────────────────────────────
const eventsListSchema = paginatedListSchema.extend({
  status: z.string().optional(),
  category: z.string().optional(),
});

const eventsCreateToolSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  timezone: z.string().max(50).optional(),
  location_type: z.enum(['in_person', 'virtual', 'hybrid']).optional(),
  venue_name: z.string().max(200).nullable().optional(),
  venue_address: z.string().max(500).nullable().optional(),
  virtual_url: z.string().url().nullable().optional(),
  category: z.string().max(50).nullable().optional(),
  registration_enabled: z.boolean().optional(),
  total_capacity: z.number().int().min(1).nullable().optional(),
  visibility: z.enum(['public', 'unlisted', 'private']).optional(),
  organizer_name: z.string().max(200).nullable().optional(),
  organizer_email: z.string().email().nullable().optional(),
});

const eventsUpdateToolSchema = eventsCreateToolSchema.partial().extend({
  id: z.string().uuid(),
});

const eventsPublishSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['publish', 'unpublish']).default('publish'),
});

const eventsListRegistrationsSchema = z.object({
  event_id: z.string().uuid(),
  status: z.string().optional(),
});

const eventsCheckInSchema = z.object({
  registration_id: z.string().uuid().optional(),
  qr_code: z.string().optional(),
}).refine(
  (data) => data.registration_id || data.qr_code,
  { message: 'Must provide registration_id or qr_code' }
);

const eventsCancelRegistrationSchema = z.object({
  registration_id: z.string().uuid(),
});

const eventsCreateTicketTypeSchema = z.object({
  event_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  quantity_available: z.number().int().min(1).nullable().optional(),
  max_per_order: z.number().int().min(1).max(100).optional(),
});

const eventsDeleteSchema = z.object({
  id: z.string().uuid(),
});

const eventSeriesBaseToolSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  description_html: z.string().max(20000).nullable().optional(),
  recurrence_frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
  recurrence_days_of_week: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional(),
  recurrence_interval: z.number().int().min(1).max(12).optional(),
  recurrence_until: z.string().date().nullable().optional(),
  recurrence_count: z.number().int().min(1).max(365).nullable().optional(),
  recurrence_day_positions: z.array(z.number().int().min(1).max(5)).min(1).max(5).nullable().optional(),
  template_start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  template_end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  timezone: z.string().max(50).optional(),
  location_type: z.enum(['in_person', 'virtual', 'hybrid']).optional(),
  venue_name: z.string().max(200).nullable().optional(),
  venue_address: z.string().max(500).nullable().optional(),
  venue_latitude: z.number().min(-90).max(90).nullable().optional(),
  venue_longitude: z.number().min(-180).max(180).nullable().optional(),
  virtual_url: z.string().url().nullable().optional(),
  registration_enabled: z.boolean().optional(),
  total_capacity: z.number().int().min(1).nullable().optional(),
  waitlist_enabled: z.boolean().optional(),
  max_tickets_per_registration: z.number().int().min(1).max(100).optional(),
  require_approval: z.boolean().optional(),
  custom_questions: z.array(z.unknown()).max(20).optional(),
  cover_image_url: z.string().url().nullable().optional(),
  category: z.string().max(50).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  visibility: z.enum(['public', 'unlisted', 'private']).optional(),
  confirmation_message: z.string().max(2000).nullable().optional(),
  cancellation_policy: z.string().max(2000).nullable().optional(),
  organizer_name: z.string().max(200).nullable().optional(),
  organizer_email: z.string().email().nullable().optional(),
  generation_horizon_days: z.number().int().min(7).max(365).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
});

const eventsListSeriesSchema = paginatedListSchema.extend({
  status: z.string().optional(),
});

const eventsCreateSeriesSchema = eventSeriesBaseToolSchema;

const eventsUpdateSeriesSchema = eventSeriesBaseToolSchema.partial().extend({
  id: z.string().uuid(),
});

function validateSeriesToolInput(data: {
  recurrence_frequency?: string | null;
  recurrence_days_of_week?: string[] | null;
  recurrence_until?: string | null;
  recurrence_count?: number | null;
  recurrence_day_positions?: number[] | null;
  template_start_time?: string | null;
  template_end_time?: string | null;
}) {
  if (data.recurrence_until && data.recurrence_count) {
    throw communityError('Specify either recurrence_until or recurrence_count, not both.');
  }

  if (
    data.template_start_time &&
    data.template_end_time &&
    data.template_end_time <= data.template_start_time
  ) {
    throw communityError('Template end time must be after template start time.');
  }

  if (
    (data.recurrence_frequency === 'weekly' || data.recurrence_frequency === 'biweekly') &&
    (!data.recurrence_days_of_week || data.recurrence_days_of_week.length === 0)
  ) {
    throw communityError('Weekly and biweekly series require at least one recurrence day.');
  }

  if (
    data.recurrence_frequency === 'monthly' &&
    data.recurrence_day_positions?.length &&
    (!data.recurrence_days_of_week || data.recurrence_days_of_week.length === 0)
  ) {
    throw communityError('Monthly series with day position require a recurrence day.');
  }
}

function validateEventToolTimeRange(data: {
  starts_at?: string | null;
  ends_at?: string | null;
}) {
  if (data.starts_at && data.ends_at && new Date(data.ends_at) <= new Date(data.starts_at)) {
    throw communityError('Event end time must be after the start time.');
  }
}

// ── Event tool definitions ──────────────────────────────────────────────────
defineCommunityTool({
  name: 'events.list',
  description: 'List events with optional status/category filtering and pagination.',
  resource: 'events',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: eventsListSchema,
  handler: async (params, ctx) => {
    const parsed = eventsListSchema.parse(params);
    const admin = createAdminClient();
    const { offset, to } = paginate(parsed.page, parsed.limit);
    let query = admin
      .from('events')
      .select('id, title, slug, status, starts_at, ends_at, location_type, venue_name, category, total_capacity, registration_enabled, updated_at', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .order('starts_at', { ascending: true })
      .range(offset, to);
    if (parsed.search) query = query.ilike('title', `%${parsed.search}%`);
    if (parsed.status) query = query.eq('status', parsed.status);
    if (parsed.category) query = query.eq('category', parsed.category);
    const { data, error, count } = await query;
    if (error) throw communityError(`Failed to list events: ${error.message}`);
    return JSON.stringify({
      events: data ?? [],
      pagination: { page: parsed.page, limit: parsed.limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / parsed.limit) },
    });
  },
});

defineCommunityTool({
  name: 'events.get',
  description: 'Get a single event with registration counts and ticket types.',
  resource: 'events',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: entityGetSchema,
  handler: async (params, ctx) => {
    const parsed = entityGetSchema.parse(params);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('events')
      .select('*, event_ticket_types(*)')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.id)
      .single();
    if (error || !data) throw communityError(`Event not found: ${error?.message ?? 'unknown error'}`);
    const { count: regCount } = await admin
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', parsed.id)
      .in('status', ['confirmed', 'pending_approval', 'pending_waiver']);
    return JSON.stringify({ ...data, registration_count: regCount ?? 0 });
  },
});

defineCommunityTool({
  name: 'events.create',
  description: 'Create a new event.',
  resource: 'events',
  action: 'create',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: eventsCreateToolSchema,
  handler: async (params, ctx) => {
    const parsed = eventsCreateToolSchema.parse(params);
    validateEventToolTimeRange(parsed);
    const admin = createAdminClient();
    const slug = generateSlug(parsed.title);
    const { data, error } = await admin
      .from('events')
      .insert({
        ...parsed,
        slug,
        project_id: ctx.projectId,
        created_by: ctx.userId,
      })
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to create event: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'event.created' as never,
      entityType: 'event',
      entityId: data.id,
      data: data as Record<string, unknown>,
    });
    return JSON.stringify({ event: data });
  },
});

defineCommunityTool({
  name: 'events.update',
  description: 'Update an event.',
  resource: 'events',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: eventsUpdateToolSchema,
  handler: async (params, ctx) => {
    const parsed = eventsUpdateToolSchema.parse(params);
    const admin = createAdminClient();
    const { id, ...updates } = parsed;
    const { data: oldEvent, error: oldEventError } = await admin
      .from('events')
      .select('id, starts_at, ends_at, series_id')
      .eq('project_id', ctx.projectId)
      .eq('id', id)
      .single();
    if (oldEventError || !oldEvent) throw communityError(`Event not found: ${oldEventError?.message ?? 'unknown error'}`);
    validateEventToolTimeRange({
      starts_at: updates.starts_at ?? oldEvent.starts_at,
      ends_at: updates.ends_at ?? oldEvent.ends_at,
    });
    const updatePayload: Record<string, unknown> = { ...updates };
    if (oldEvent.series_id) {
      updatePayload.series_instance_modified = true;
    }
    const { data, error } = await admin
      .from('events')
      .update(updatePayload)
      .eq('project_id', ctx.projectId)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to update event: ${error?.message ?? 'unknown error'}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.updated',
      entityType: 'event',
      entityId: data.id,
      data: data as Record<string, unknown>,
    });
    return JSON.stringify({ event: data });
  },
});

defineCommunityTool({
  name: 'events.publish',
  description: 'Publish or unpublish an event.',
  resource: 'events',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: eventsPublishSchema,
  handler: async (params, ctx) => {
    const parsed = eventsPublishSchema.parse(params);
    const admin = createAdminClient();
    const isPublish = parsed.action === 'publish';
    const { data: currentEvent, error: currentEventError } = await admin
      .from('events')
      .select('id, status, published_at')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.id)
      .single();
    if (currentEventError || !currentEvent) {
      throw communityError(`Event not found: ${currentEventError?.message ?? 'unknown error'}`);
    }
    const { data, error } = await admin
      .from('events')
      .update({
        status: isPublish ? 'published' : 'draft',
        published_at: isPublish
          ? (currentEvent.status === 'draft' ? new Date().toISOString() : currentEvent.published_at)
          : null,
      })
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.id)
      .select('id, title, status, published_at')
      .single();
    if (error || !data) throw communityError(`Failed to ${parsed.action} event: ${error?.message ?? 'unknown error'}`);
    if (isPublish) {
      emitAutomationEvent({
        projectId: ctx.projectId,
        triggerType: 'event.published' as never,
        entityType: 'event',
        entityId: data.id,
        data: data as Record<string, unknown>,
      });
    }
    return JSON.stringify({ event: data });
  },
});

defineCommunityTool({
  name: 'events.list_registrations',
  description: 'List registrations for an event.',
  resource: 'events',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: eventsListRegistrationsSchema,
  handler: async (params, ctx) => {
    const parsed = eventsListRegistrationsSchema.parse(params);
    const admin = createAdminClient();
    // Verify event belongs to project
    const { data: event } = await admin
      .from('events')
      .select('id')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.event_id)
      .single();
    if (!event) throw communityError('Event not found');
    let query = admin
      .from('event_registrations')
      .select('id, registrant_name, registrant_email, status, checked_in_at, created_at')
      .eq('event_id', parsed.event_id)
      .order('created_at', { ascending: false });
    if (parsed.status) query = query.eq('status', parsed.status);
    const { data, error } = await query;
    if (error) throw communityError(`Failed to list registrations: ${error.message}`);
    return JSON.stringify({ registrations: data ?? [] });
  },
});

defineCommunityTool({
  name: 'events.check_in',
  description: 'Check in an attendee by registration ID or QR code.',
  resource: 'events',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: eventsCheckInSchema,
  handler: async (params, ctx) => {
    const parsed = eventsCheckInSchema.parse(params);
    const admin = createAdminClient();
    let registrationId = parsed.registration_id;
    let qrTicketId: string | null = null;
    if (!registrationId && parsed.qr_code) {
      const { data: ticket } = await admin
        .from('event_registration_tickets')
        .select('id, registration_id, checked_in_at')
        .eq('qr_code', parsed.qr_code)
        .single();
      if (!ticket) throw communityError('QR code not found');
      if (ticket.checked_in_at) throw communityError('Ticket has already been checked in');
      registrationId = ticket.registration_id;
      qrTicketId = ticket.id;
    }
    if (!registrationId) throw communityError('Must provide registration_id or qr_code');
    // Verify registration belongs to project
    const { data: reg } = await admin
      .from('event_registrations')
      .select('id, event_id, person_id, status, events!inner(project_id)')
      .eq('id', registrationId)
      .single();
    if (!reg) throw communityError('Registration not found');
    const eventData = reg.events as unknown as { project_id: string };
    if (eventData.project_id !== ctx.projectId) throw communityError('Registration not found');
    if (reg.status === 'cancelled' || reg.status === 'waitlisted') {
      throw communityError(`Cannot check in a ${reg.status} registration`);
    }
    const now = new Date().toISOString();
    if (qrTicketId) {
      const { error: ticketError } = await admin
        .from('event_registration_tickets')
        .update({ checked_in_at: now })
        .eq('id', qrTicketId)
        .is('checked_in_at', null);
      if (ticketError) throw communityError(`Failed to sync ticket check-in state: ${ticketError.message}`);
    } else {
      const { data: openTickets } = await admin
        .from('event_registration_tickets')
        .select('id')
        .eq('registration_id', registrationId)
        .is('checked_in_at', null);

      if (!openTickets || openTickets.length === 0) {
        const { count: existingTicketCount } = await admin
          .from('event_registration_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('registration_id', registrationId);

        if ((existingTicketCount ?? 0) > 0) {
          throw communityError('Registration has already been checked in');
        }
        throw communityError('No tickets found for this registration');
      }

      const { error: ticketError } = await admin
        .from('event_registration_tickets')
        .update({ checked_in_at: now })
        .eq('registration_id', registrationId)
        .is('checked_in_at', null);
      if (ticketError) throw communityError(`Failed to sync ticket check-in state: ${ticketError.message}`);
    }
    const { data, error } = await admin
      .from('event_registrations')
      .update({ checked_in_at: now, checked_in_by: ctx.userId })
      .eq('id', registrationId)
      .select('id, registrant_name, checked_in_at')
      .single();
    if (error || !data) throw communityError(`Failed to check in: ${error?.message ?? 'unknown error'}`);
    if (reg.person_id) {
      bridgeCheckInToAttendance(reg.event_id, reg.person_id).catch((err) =>
        console.error('Attendance bridge failed for chat check-in:', err)
      );
    }
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'event.registration.checked_in' as never,
      entityType: 'event_registration',
      entityId: registrationId,
      data: qrTicketId
        ? { event_id: reg.event_id, ticket_id: qrTicketId }
        : { event_id: reg.event_id },
    });
    return JSON.stringify({ checked_in: data });
  },
});

defineCommunityTool({
  name: 'events.cancel_registration',
  description: 'Cancel an event registration and promote from waitlist if applicable.',
  resource: 'events',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: eventsCancelRegistrationSchema,
  handler: async (params, ctx) => {
    const parsed = eventsCancelRegistrationSchema.parse(params);
    const admin = createAdminClient();
    // Verify registration belongs to project
    const { data: reg } = await admin
      .from('event_registrations')
      .select('id, event_id, status, events!inner(project_id, waitlist_enabled)')
      .eq('id', parsed.registration_id)
      .single();
    if (!reg) throw communityError('Registration not found');
    const eventData = reg.events as unknown as { project_id: string; waitlist_enabled: boolean };
    if (eventData.project_id !== ctx.projectId) throw communityError('Registration not found');
    if (reg.status === 'cancelled') throw communityError('Registration is already cancelled');
    const { data, error } = await admin
      .from('event_registrations')
      .update({ status: 'cancelled' })
      .eq('id', parsed.registration_id)
      .select('id, registrant_name, status')
      .single();
    if (error || !data) throw communityError(`Failed to cancel registration: ${error?.message ?? 'unknown error'}`);
    sendEventCancellationConfirmation(parsed.registration_id).catch((err) =>
      console.error('Cancellation confirmation failed for chat cancellation:', err)
    );
    if (eventData.waitlist_enabled) {
      promoteFromWaitlist(reg.event_id)
        .then((promotedId) => {
          if (!promotedId) return;
          sendWaitlistPromotionNotification(promotedId).catch((err) =>
            console.error('Waitlist promotion notification failed for chat cancellation:', err)
          );
        })
        .catch(err => console.error('Waitlist promotion failed:', err));
    }
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'event.registration.cancelled' as never,
      entityType: 'event_registration',
      entityId: parsed.registration_id,
      data: { event_id: reg.event_id, status: 'cancelled', previous_status: reg.status },
    });
    return JSON.stringify({ registration: data });
  },
});

defineCommunityTool({
  name: 'events.create_ticket_type',
  description: 'Add a ticket type to an event.',
  resource: 'events',
  action: 'create',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: eventsCreateTicketTypeSchema,
  handler: async (params, ctx) => {
    const parsed = eventsCreateTicketTypeSchema.parse(params);
    const admin = createAdminClient();
    // Verify event belongs to project
    const { data: event } = await admin
      .from('events')
      .select('id')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.event_id)
      .single();
    if (!event) throw communityError('Event not found');
    const { data, error } = await admin
      .from('event_ticket_types')
      .insert({
        event_id: parsed.event_id,
        name: parsed.name,
        description: parsed.description ?? null,
        quantity_available: parsed.quantity_available ?? null,
        max_per_order: parsed.max_per_order ?? 10,
      })
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to create ticket type: ${error?.message ?? 'unknown error'}`);
    return JSON.stringify({ ticket_type: data });
  },
});

defineCommunityTool({
  name: 'events.delete',
  description: 'Delete an event.',
  resource: 'events',
  action: 'delete',
  roles: ['owner', 'admin', 'staff'],
  parameters: eventsDeleteSchema,
  handler: async (params, ctx) => {
    const parsed = eventsDeleteSchema.parse(params);
    const admin = createAdminClient();
    const { error } = await admin
      .from('events')
      .delete()
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.id)
      .select('id')
      .single();
    if (error) throw communityError(`Failed to delete event: ${error.message}`);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.deleted',
      entityType: 'event',
      entityId: parsed.id,
      data: { id: parsed.id, project_id: ctx.projectId },
    });
    return JSON.stringify({ success: true, id: parsed.id });
  },
});

defineCommunityTool({
  name: 'events.list_series',
  description: 'List recurring event series with pagination.',
  resource: 'events',
  action: 'view',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: eventsListSeriesSchema,
  handler: async (params, ctx) => {
    const parsed = eventsListSeriesSchema.parse(params);
    const admin = createAdminClient();
    const { offset, to } = paginate(parsed.page, parsed.limit);
    let query = admin
      .from('event_series')
      .select('*', { count: 'exact' })
      .eq('project_id', ctx.projectId)
      .order('created_at', { ascending: false })
      .range(offset, to);
    if (parsed.status) query = query.eq('status', parsed.status);
    const { data, error, count } = await query;
    if (error) throw communityError(`Failed to list event series: ${error.message}`);
    return JSON.stringify({
      series: data ?? [],
      pagination: { page: parsed.page, limit: parsed.limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / parsed.limit) },
    });
  },
});

defineCommunityTool({
  name: 'events.create_series',
  description: 'Create a recurring event series and generate its upcoming instances.',
  resource: 'events',
  action: 'create',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: eventsCreateSeriesSchema,
  handler: async (params, ctx) => {
    const parsed = eventsCreateSeriesSchema.parse(params);
    validateSeriesToolInput(parsed);
    const admin = createAdminClient();
    const seriesInsert: Database['public']['Tables']['event_series']['Insert'] = {
      ...parsed,
      custom_questions: parsed.custom_questions as Json | undefined,
      project_id: ctx.projectId,
      created_by: ctx.userId,
      status: parsed.status ?? 'active',
    };
    const { data, error } = await admin
      .from('event_series')
      .insert(seriesInsert)
      .select('*')
      .single();
    if (error || !data) throw communityError(`Failed to create event series: ${error?.message ?? 'unknown error'}`);
    const instancesGenerated = await generateSeriesInstances(data.id);
    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'event.created' as never,
      entityType: 'event_series',
      entityId: data.id,
      data: { ...data as Record<string, unknown>, instances_generated: instancesGenerated },
    });
    return JSON.stringify({ series: data, instances_generated: instancesGenerated });
  },
});

defineCommunityTool({
  name: 'events.update_series',
  description: 'Update a recurring event series and propagate changes to future unmodified instances.',
  resource: 'events',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: eventsUpdateSeriesSchema,
  handler: async (params, ctx) => {
    const parsed = eventsUpdateSeriesSchema.parse(params);
    const admin = createAdminClient();
    const { id, ...updates } = parsed;
    const { data: oldSeries, error: oldSeriesError } = await admin
      .from('event_series')
      .select('*')
      .eq('project_id', ctx.projectId)
      .eq('id', id)
      .single();
    if (oldSeriesError || !oldSeries) throw communityError(`Event series not found: ${oldSeriesError?.message ?? 'unknown error'}`);

    const seriesUpdates: Database['public']['Tables']['event_series']['Update'] = {
      ...updates,
      custom_questions: updates.custom_questions as Json | undefined,
    };
    const mergedSeries = {
      ...oldSeries,
      ...seriesUpdates,
    } as Database['public']['Tables']['event_series']['Row'];
    validateSeriesToolInput(mergedSeries);

    const scheduleFields = [
      'recurrence_frequency',
      'recurrence_days_of_week',
      'recurrence_interval',
      'recurrence_until',
      'recurrence_count',
      'recurrence_day_positions',
      'template_start_time',
      'template_end_time',
      'timezone',
    ];
    const touchesSchedule = scheduleFields.some((field) => (seriesUpdates as Record<string, unknown>)[field] !== undefined);

    if (touchesSchedule) {
      const preflightResult = await syncFutureSeriesInstances({
        seriesId: id,
        previousSeries: oldSeries,
        nextSeries: mergedSeries,
        dryRun: true,
      });

      if (preflightResult.error) {
        throw communityError(preflightResult.error);
      }
    }

    const { data: series, error } = await admin
      .from('event_series')
      .update(seriesUpdates)
      .eq('project_id', ctx.projectId)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !series) throw communityError(`Failed to update event series: ${error?.message ?? 'unknown error'}`);

    const propagatableFields = [
      'title',
      'description',
      'description_html',
      'venue_name',
      'venue_address',
      'venue_latitude',
      'venue_longitude',
      'virtual_url',
      'location_type',
      'total_capacity',
      'registration_enabled',
      'waitlist_enabled',
      'require_approval',
      'custom_questions',
      'visibility',
      'confirmation_message',
      'cancellation_policy',
      'organizer_name',
      'organizer_email',
      'cover_image_url',
      'category',
      'tags',
    ];

    const propagatable = Object.fromEntries(
      Object.entries(updates).filter(([key, value]) => propagatableFields.includes(key) && value !== undefined)
    );

    const updatedInstances = Object.keys(propagatable).length > 0
      ? await updateFutureInstances(id, propagatable)
      : 0;

    const scheduleSync = touchesSchedule
      ? await syncFutureSeriesInstances({
          seriesId: id,
          previousSeries: oldSeries,
          nextSeries: series,
        })
      : null;

    if (scheduleSync?.error) {
      throw communityError(scheduleSync.error);
    }

    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'entity.updated',
      entityType: 'event_series',
      entityId: id,
      data: series as Record<string, unknown>,
      previousData: oldSeries as Record<string, unknown>,
    });

    return JSON.stringify({
      series,
      updated_instances: updatedInstances,
      schedule_sync: scheduleSync
        ? { updated: scheduleSync.updated, created: scheduleSync.created, deleted: scheduleSync.deleted }
        : null,
    });
  },
});

// --- Attendance matching & confirmation (chat-driven scan flow) ---

const eventsMatchAttendanceSchema = z.object({
  event_id: z.string().uuid().describe('The event ID'),
  names: z.array(z.object({
    name: z.string().describe('Person name to match'),
    email: z.string().optional().nullable().describe('Email if known'),
    phone: z.string().optional().nullable().describe('Phone if known'),
  })).min(1).max(200).describe('List of names to match against CRM people'),
});

const eventsConfirmAttendanceSchema = z.object({
  event_id: z.string().uuid().describe('The event ID'),
  confirmations: z.array(z.object({
    raw_text: z.string().describe('Name as provided'),
    person_id: z.string().uuid().nullable().optional().describe('Matched person ID (null to create new)'),
    create_new: z.boolean().default(false).describe('Create a new person record if unmatched'),
    email: z.string().nullable().optional().describe('Email to save on person'),
    phone: z.string().nullable().optional().describe('Phone to save on person'),
  })).min(1).describe('Attendance confirmations — each entry either links to an existing person or creates a new one'),
  auto_confirm_matched: z.boolean().default(true).describe('When true, auto-confirm high-confidence matches and only return unmatched/possible for review'),
});

defineCommunityTool({
  name: 'events.match_attendance',
  description: 'Match a list of names against CRM people for an event. Returns match status (matched/possible/unmatched) for each name. Use this to preview attendance before confirming.',
  resource: 'events',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: eventsMatchAttendanceSchema,
  handler: async (params, ctx) => {
    const parsed = eventsMatchAttendanceSchema.parse(params);
    const admin = createAdminClient();
    // Verify event belongs to project
    const { data: event } = await admin
      .from('events')
      .select('id')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.event_id)
      .single();
    if (!event) throw communityError('Event not found');

    const matched = await matchParsedNames(parsed.names, ctx.projectId);
    const summary = {
      total: matched.length,
      matched: matched.filter(m => m.match_status === 'matched').length,
      possible: matched.filter(m => m.match_status === 'possible').length,
      unmatched: matched.filter(m => m.match_status === 'unmatched').length,
    };
    return JSON.stringify({ parsed_names: matched, summary });
  },
});

defineCommunityTool({
  name: 'events.confirm_attendance',
  description: 'Confirm attendance for an event. Accepts matched person IDs and/or creates new people for unmatched names. Each confirmation creates a registration (if needed) and marks the person as checked in.',
  resource: 'events',
  action: 'update',
  roles: ['owner', 'admin', 'staff', 'case_manager'],
  parameters: eventsConfirmAttendanceSchema,
  handler: async (params, ctx) => {
    const parsed = eventsConfirmAttendanceSchema.parse(params);
    const admin = createAdminClient();
    // Verify event belongs to project
    const { data: event } = await admin
      .from('events')
      .select('id')
      .eq('project_id', ctx.projectId)
      .eq('id', parsed.event_id)
      .single();
    if (!event) throw communityError('Event not found');

    const now = new Date().toISOString();
    let processed = 0;

    // Load or create a fallback ticket type
    let fallbackTicketTypeId: string | null = null;
    const loadFallbackTicketType = async () => {
      if (fallbackTicketTypeId) return fallbackTicketTypeId;
      const { data: existing } = await admin
        .from('event_ticket_types')
        .select('id')
        .eq('event_id', parsed.event_id)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (existing?.id) { fallbackTicketTypeId = existing.id; return existing.id; }
      const { data: created, error } = await admin
        .from('event_ticket_types')
        .insert({ event_id: parsed.event_id, name: 'Walk-in', description: 'Auto-created for attendance confirmation', quantity_available: null, max_per_order: 1, sort_order: 999, is_active: true, is_hidden: true })
        .select('id')
        .single();
      if (error || !created) throw communityError(`Failed to create ticket type: ${error?.message}`);
      fallbackTicketTypeId = created.id;
      return created.id;
    };

    for (const confirmation of parsed.confirmations) {
      let personId = confirmation.person_id || null;

      // Create new person if requested
      if (confirmation.create_new && !personId) {
        const nameParts = confirmation.raw_text.trim().split(/\s+/);
        const firstName = nameParts[0] || confirmation.raw_text;
        const lastName = nameParts.slice(1).join(' ') || '(unknown)';
        const validEmail = confirmation.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(confirmation.email) ? confirmation.email : null;
        const { data: newPerson, error: personError } = await admin
          .from('people')
          .insert({ project_id: ctx.projectId, first_name: firstName, last_name: lastName, created_by: ctx.userId, email: validEmail, phone: confirmation.phone ?? null })
          .select('id')
          .single();
        if (personError || !newPerson) { continue; }
        personId = newPerson.id;
      }

      if (!personId) continue;

      // Update person with new contact info if applicable
      if (!confirmation.create_new && (confirmation.email || confirmation.phone)) {
        const { data: existingPerson } = await admin.from('people').select('email, phone, mobile_phone').eq('id', personId).single();
        if (existingPerson) {
          const updates: Record<string, string> = {};
          const validEmail = confirmation.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(confirmation.email) ? confirmation.email : null;
          if (validEmail && !existingPerson.email) updates.email = validEmail;
          if (confirmation.phone && !existingPerson.phone && !existingPerson.mobile_phone) updates.phone = confirmation.phone;
          if (Object.keys(updates).length > 0) {
            await admin.from('people').update(updates).eq('id', personId).eq('project_id', ctx.projectId);
          }
        }
      }

      // Find existing registration or create one
      const { data: reg } = await admin
        .from('event_registrations')
        .select('id, registrant_email, registrant_name, status')
        .eq('event_id', parsed.event_id)
        .eq('person_id', personId)
        .in('status', ['confirmed', 'pending_approval', 'pending_waiver'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reg) {
        await admin.from('event_registrations').update({ checked_in_at: now, checked_in_by: ctx.userId }).eq('id', reg.id);
        const { count: ticketCount } = await admin.from('event_registration_tickets').select('id', { count: 'exact', head: true }).eq('registration_id', reg.id);
        if ((ticketCount ?? 0) === 0) {
          const ticketTypeId = await loadFallbackTicketType();
          await admin.from('event_registration_tickets').insert({ registration_id: reg.id, ticket_type_id: ticketTypeId, attendee_name: reg.registrant_name, attendee_email: reg.registrant_email, checked_in_at: now });
        } else {
          await admin.from('event_registration_tickets').update({ checked_in_at: now }).eq('registration_id', reg.id);
        }
      } else {
        const { data: person } = await admin.from('people').select('email, first_name, last_name').eq('id', personId).maybeSingle();
        const registrantEmail = person?.email || `${personId}@manual-registration.local`;
        const registrantName = person ? [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || confirmation.raw_text : confirmation.raw_text;
        const { data: newReg, error: insertErr } = await admin
          .from('event_registrations')
          .insert({ event_id: parsed.event_id, person_id: personId, registrant_name: registrantName, registrant_email: registrantEmail, status: 'confirmed', checked_in_at: now, checked_in_by: ctx.userId, waiver_status: 'not_required', source: 'manual' })
          .select('id, registrant_name, registrant_email')
          .single();
        if (insertErr || !newReg) continue;
        const ticketTypeId = await loadFallbackTicketType();
        await admin.from('event_registration_tickets').insert({ registration_id: newReg.id, ticket_type_id: ticketTypeId, attendee_name: newReg.registrant_name, attendee_email: newReg.registrant_email, checked_in_at: now });
      }

      bridgeCheckInToAttendance(parsed.event_id, personId).catch(err => console.error('Attendance bridge failed:', err));
      processed++;
    }

    emitAutomationEvent({
      projectId: ctx.projectId,
      triggerType: 'event.attendance.confirmed' as never,
      entityType: 'event',
      entityId: parsed.event_id,
      data: { processed },
    });

    return JSON.stringify({ success: true, processed });
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
