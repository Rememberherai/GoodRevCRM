import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { applyResearchSchema } from '@/lib/validators/research';
import type { ResearchJob } from '@/types/research';
import type { Database } from '@/types/database';
import { createDebugger } from '@/lib/debug';

const log = createDebugger('research-apply');

type OrganizationUpdate = Database['public']['Tables']['organizations']['Update'];
type PersonUpdate = Database['public']['Tables']['people']['Update'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// Standard field names for organizations
const ORGANIZATION_STANDARD_FIELDS = new Set([
  'name', 'domain', 'website', 'industry', 'employee_count', 'annual_revenue',
  'description', 'logo_url', 'linkedin_url', 'phone',
  'address_street', 'address_city', 'address_state', 'address_postal_code', 'address_country',
]);

// Standard field names for people
const PERSON_STANDARD_FIELDS = new Set([
  'first_name', 'last_name', 'email', 'phone', 'job_title',
  'linkedin_url', 'notes',
  'address_street', 'address_city', 'address_state', 'address_postal_code', 'address_country',
]);

// Helper to parse revenue string to number (e.g., "$50B" -> 50000000000)
function parseRevenueToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;

  // Remove currency symbols and spaces
  const cleaned = value.replace(/[$,\s]/g, '').toLowerCase();
  if (!cleaned) return null;

  // Parse multipliers
  let multiplier = 1;
  let numStr = cleaned;

  if (cleaned.endsWith('t') || cleaned.endsWith('trillion')) {
    multiplier = 1_000_000_000_000;
    numStr = cleaned.replace(/t(rillion)?$/, '');
  } else if (cleaned.endsWith('b') || cleaned.endsWith('billion')) {
    multiplier = 1_000_000_000;
    numStr = cleaned.replace(/b(illion)?$/, '');
  } else if (cleaned.endsWith('m') || cleaned.endsWith('million')) {
    multiplier = 1_000_000;
    numStr = cleaned.replace(/m(illion)?$/, '');
  } else if (cleaned.endsWith('k') || cleaned.endsWith('thousand')) {
    multiplier = 1_000;
    numStr = cleaned.replace(/k|(thousand)$/, '');
  }

  const num = parseFloat(numStr);
  return isNaN(num) ? null : Math.round(num * multiplier);
}

// POST /api/projects/[slug]/research/[id]/apply - Apply research results to entity
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project ID from slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch research job
    // Use type assertion since research_jobs table isn't in generated types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    const { data: job, error: jobError } = await supabaseAny
      .from('research_jobs')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (jobError || !job) {
      log.error('Error fetching research job', jobError);
      return NextResponse.json({ error: 'Research job not found' }, { status: 404 });
    }

    const typedJob = job as ResearchJob;

    if (typedJob.status !== 'completed') {
      return NextResponse.json(
        { error: 'Cannot apply results from incomplete research job' },
        { status: 400 }
      );
    }

    const body = await request.json();
    log.log('Apply request body', body);

    const validationResult = applyResearchSchema.safeParse(body);

    if (!validationResult.success) {
      log.error('Validation failed', validationResult.error.flatten());
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { field_updates } = validationResult.data;

    // Separate standard fields from custom fields
    const standardUpdates: Record<string, unknown> = {};
    const customFieldUpdates: Record<string, unknown> = {};

    const standardFields = typedJob.entity_type === 'organization'
      ? ORGANIZATION_STANDARD_FIELDS
      : PERSON_STANDARD_FIELDS;

    log.log('Processing field updates', { count: field_updates.length, standardFields: Array.from(standardFields) });
    for (const update of field_updates) {
      log.log('Processing field', { field: update.field_name, is_custom: update.is_custom, valueType: typeof update.value });
      if (update.is_custom) {
        customFieldUpdates[update.field_name] = update.value;
      } else if (standardFields.has(update.field_name)) {
        // Handle type conversions for specific fields
        let processedValue = update.value;

        if (update.field_name === 'annual_revenue' && typedJob.entity_type === 'organization') {
          // Convert revenue string to number
          processedValue = parseRevenueToNumber(update.value);
          log.log('Converted annual_revenue', { from: update.value, to: processedValue });
        }

        standardUpdates[update.field_name] = processedValue;
      } else {
        log.log('Field not in standard fields list', update.field_name);
      }
    }

    // Fetch current custom fields to merge
    let currentEntity: Record<string, unknown> | null = null;

    if (typedJob.entity_type === 'organization') {
      const { data } = await supabase
        .from('organizations')
        .select('custom_fields')
        .eq('id', typedJob.entity_id)
        .single();
      currentEntity = data;
    } else if (typedJob.entity_type === 'person') {
      const { data } = await supabase
        .from('people')
        .select('custom_fields')
        .eq('id', typedJob.entity_id)
        .single();
      currentEntity = data;
    }

    // Merge custom fields
    const existingCustomFields = (currentEntity?.custom_fields ?? {}) as Record<string, unknown>;
    const mergedCustomFields = { ...existingCustomFields, ...customFieldUpdates };

    // Build the final update object
    // Only include custom_fields if there are custom field updates
    const updateData: Record<string, unknown> = {
      ...standardUpdates,
    };

    if (Object.keys(customFieldUpdates).length > 0) {
      updateData.custom_fields = mergedCustomFields;
    }

    log.log('Update summary', {
      standardUpdates,
      customFieldUpdates,
      finalUpdateData: updateData,
      entityType: typedJob.entity_type,
      entityId: typedJob.entity_id
    });

    // Check if there's actually anything to update
    if (Object.keys(updateData).length === 0) {
      log.log('No fields to update');
      return NextResponse.json({
        success: true,
        fields_updated: 0,
        standard_fields: [],
        custom_fields: [],
        message: 'No fields to update',
      });
    }

    // Update the entity
    if (typedJob.entity_type === 'organization') {
      const { data: updateResult, error: updateError } = await supabase
        .from('organizations')
        .update(updateData as OrganizationUpdate)
        .eq('id', typedJob.entity_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .select();

      log.log('Organization update result', { result: updateResult, error: updateError });

      if (updateError) {
        log.error('Error updating organization', updateError);
        return NextResponse.json({ error: 'Failed to apply research results', details: updateError.message, code: updateError.code }, { status: 500 });
      }

      if (!updateResult || updateResult.length === 0) {
        log.error('No rows updated - organization not found or deleted');
        return NextResponse.json({ error: 'Organization not found or has been deleted' }, { status: 404 });
      }
    } else if (typedJob.entity_type === 'person') {
      const { data: updateResult, error: updateError } = await supabase
        .from('people')
        .update(updateData as PersonUpdate)
        .eq('id', typedJob.entity_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .select();

      log.log('Person update result', { result: updateResult, error: updateError });

      if (updateError) {
        log.error('Error updating person', updateError);
        return NextResponse.json({ error: 'Failed to apply research results', details: updateError.message, code: updateError.code }, { status: 500 });
      }

      if (!updateResult || updateResult.length === 0) {
        log.error('No rows updated - person not found or deleted');
        return NextResponse.json({ error: 'Person not found or has been deleted' }, { status: 404 });
      }
    }

    // Count fields updated
    const fieldsUpdated = Object.keys(standardUpdates).length + Object.keys(customFieldUpdates).length;

    return NextResponse.json({
      success: true,
      fields_updated: fieldsUpdated,
      standard_fields: Object.keys(standardUpdates),
      custom_fields: Object.keys(customFieldUpdates),
    });
  } catch (error) {
    log.error('Unhandled error in research apply', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    log.error('Error stack', errorStack);
    return NextResponse.json({
      error: 'Internal server error',
      details: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 });
  }
}
