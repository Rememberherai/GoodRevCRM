import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { applyResearchSchema } from '@/lib/validators/research';
import type { ResearchJob } from '@/types/research';
import type { Database } from '@/types/database';

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
      console.error('Error fetching research job:', jobError);
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
    console.log('Apply request body:', JSON.stringify(body, null, 2));

    const validationResult = applyResearchSchema.safeParse(body);

    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.flatten());
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

    console.log('Processing', field_updates.length, 'field updates');
    console.log('Standard fields allowed:', Array.from(standardFields));
    for (const update of field_updates) {
      console.log('Field:', update.field_name, 'is_custom:', update.is_custom, 'value type:', typeof update.value);
      if (update.is_custom) {
        customFieldUpdates[update.field_name] = update.value;
      } else if (standardFields.has(update.field_name)) {
        standardUpdates[update.field_name] = update.value;
      } else {
        console.log('WARNING: Field not in standard fields list:', update.field_name);
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

    console.log('Standard updates:', JSON.stringify(standardUpdates, null, 2));
    console.log('Custom field updates:', JSON.stringify(customFieldUpdates, null, 2));
    console.log('Final update data:', JSON.stringify(updateData, null, 2));
    console.log('Entity type:', typedJob.entity_type, 'Entity ID:', typedJob.entity_id);

    // Check if there's actually anything to update
    if (Object.keys(updateData).length === 0) {
      console.log('No fields to update');
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
        .select();

      console.log('Organization update result:', updateResult, 'Error:', updateError);

      if (updateError) {
        console.error('Error updating organization:', updateError);
        return NextResponse.json({ error: 'Failed to apply research results', details: updateError.message }, { status: 500 });
      }
    } else if (typedJob.entity_type === 'person') {
      const { data: updateResult, error: updateError } = await supabase
        .from('people')
        .update(updateData as PersonUpdate)
        .eq('id', typedJob.entity_id)
        .eq('project_id', project.id)
        .select();

      console.log('Person update result:', updateResult, 'Error:', updateError);

      if (updateError) {
        console.error('Error updating person:', updateError);
        return NextResponse.json({ error: 'Failed to apply research results', details: updateError.message }, { status: 500 });
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
    console.error('Error in POST /api/projects/[slug]/research/[id]/apply:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
