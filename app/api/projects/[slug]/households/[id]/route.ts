import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateHouseholdSchema } from '@/lib/validators/community/households';
import {
  checkCommunityPermission,
  requireCommunityPermission,
} from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type HouseholdUpdate = Database['public']['Tables']['households']['Update'];
type Household = Database['public']['Tables']['households']['Row'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/households/[id] - Get single household
export async function GET(_request: Request, context: RouteContext) {
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

    // Check permission
    const role = await requireCommunityPermission(supabase, user.id, project.id, 'households', 'view');
    const canViewIntake = checkCommunityPermission(role, 'intake', 'view');

    // Fetch household with members joined
    const { data: household, error } = await supabase
      .from('households')
      .select('*, household_members(*, person:people(id, first_name, last_name, email))')
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (error || !household) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    // Get related counts and intake records in parallel.
    const [intakeResult, programsResult, contributionsResult] = await Promise.all([
      canViewIntake
        ? supabase
            .from('household_intake')
            .select('*')
            .eq('household_id', id)
            .order('assessed_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('program_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', id),
      supabase
        .from('contributions')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .or(`donor_household_id.eq.${id},recipient_household_id.eq.${id}`),
    ]);

    return NextResponse.json({
      household: {
        ...household,
        intake_records: intakeResult.data ?? [],
        can_view_intake: canViewIntake,
        program_enrollments_count: programsResult.count ?? 0,
        contributions_count: contributionsResult.count ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/households/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/households/[id] - Update household
export async function PATCH(request: Request, context: RouteContext) {
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

    // Check permission
    await requireCommunityPermission(supabase, user.id, project.id, 'households', 'update');

    const body = await request.json();
    const validationResult = updateHouseholdSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const updates = { ...validationResult.data };
    delete updates.members;
    delete updates.intake;

    // Build the update object
    const updateData: HouseholdUpdate = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.address_street !== undefined) updateData.address_street = updates.address_street;
    if (updates.address_city !== undefined) updateData.address_city = updates.address_city;
    if (updates.address_state !== undefined) updateData.address_state = updates.address_state;
    if (updates.address_postal_code !== undefined) updateData.address_postal_code = updates.address_postal_code;
    if (updates.address_country !== undefined) updateData.address_country = updates.address_country;
    if (updates.latitude !== undefined) updateData.latitude = updates.latitude;
    if (updates.longitude !== undefined) updateData.longitude = updates.longitude;
    if (updates.geocoded_status !== undefined) updateData.geocoded_status = updates.geocoded_status;
    if (updates.household_size !== undefined) updateData.household_size = updates.household_size;
    if (updates.primary_contact_person_id !== undefined) updateData.primary_contact_person_id = updates.primary_contact_person_id;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.custom_fields !== undefined) {
      updateData.custom_fields = updates.custom_fields as HouseholdUpdate['custom_fields'];
    }

    const { data: household, error } = await supabase
      .from('households')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Household not found' }, { status: 404 });
      }
      console.error('Error updating household:', error);
      return NextResponse.json({ error: 'Failed to update household' }, { status: 500 });
    }

    // Emit automation events
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'household',
      entityId: id,
      data: household as unknown as Record<string, unknown>,
      previousData: updates as Record<string, unknown>,
    });

    // Emit field.changed for each updated field
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        emitAutomationEvent({
          projectId: project.id,
          triggerType: 'field.changed',
          entityType: 'household',
          entityId: id,
          data: household as unknown as Record<string, unknown>,
          previousData: { [key]: undefined },
        });
      }
    }

    return NextResponse.json({ household: household as Household });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/households/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/households/[id] - Soft delete household
export async function DELETE(_request: Request, context: RouteContext) {
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

    // Check permission
    await requireCommunityPermission(supabase, user.id, project.id, 'households', 'delete');

    // Soft delete by setting deleted_at
    const { error } = await supabase
      .from('households')
      .update({ deleted_at: new Date().toISOString() } as HouseholdUpdate)
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .select('id')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Household not found' }, { status: 404 });
      }
      console.error('Error deleting household:', error);
      return NextResponse.json({ error: 'Failed to delete household' }, { status: 500 });
    }

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'household',
      entityId: id,
      data: { id, project_id: project.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/projects/[slug]/households/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
