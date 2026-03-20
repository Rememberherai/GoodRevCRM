import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { householdIntakeSchema } from '@/lib/validators/community/households';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type HouseholdIntakeInsert = Database['public']['Tables']['household_intake']['Insert'];
type HouseholdIntakeUpdate = Database['public']['Tables']['household_intake']['Update'];
type HouseholdIntake = Database['public']['Tables']['household_intake']['Row'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/households/[id]/intake - List intake records
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

    // Check permission — intake requires case_manager+ role
    await requireCommunityPermission(supabase, user.id, project.id, 'intake', 'view');

    // Verify household exists and belongs to project
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (householdError || !household) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    // Fetch intake records
    const { data: intakeRecords, error } = await supabase
      .from('household_intake')
      .select('*, assessor:users!household_intake_assessed_by_fkey(id, full_name, email)')
      .eq('household_id', id)
      .order('assessed_at', { ascending: false });

    if (error) {
      console.error('Error fetching intake records:', error);
      return NextResponse.json({ error: 'Failed to fetch intake records' }, { status: 500 });
    }

    return NextResponse.json({ intake_records: intakeRecords ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/households/[id]/intake:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/households/[id]/intake - Create intake record
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

    // Check permission — intake requires case_manager+ role
    await requireCommunityPermission(supabase, user.id, project.id, 'intake', 'create');

    // Verify household exists and belongs to project
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (householdError || !household) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = householdIntakeSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const intakeData: HouseholdIntakeInsert = {
      household_id: id,
      assessed_by: user.id,
      assessed_at: validationResult.data.assessed_at ?? new Date().toISOString(),
      needs: validationResult.data.needs as HouseholdIntakeInsert['needs'],
      notes: validationResult.data.notes ?? null,
      status: validationResult.data.status ?? 'draft',
    };

    const { data: intake, error } = await supabase
      .from('household_intake')
      .insert(intakeData)
      .select()
      .single();

    if (error) {
      console.error('Error creating intake record:', error);
      return NextResponse.json({ error: 'Failed to create intake record' }, { status: 500 });
    }

    const createdIntake = intake as HouseholdIntake;

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created',
      entityType: 'intake',
      entityId: createdIntake.id,
      data: {
        event: 'intake.created',
        household_id: id,
        intake_id: createdIntake.id,
        status: createdIntake.status,
        assessed_by: createdIntake.assessed_by,
      },
    });

    return NextResponse.json({ intake: createdIntake }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/households/[id]/intake:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/households/[id]/intake - Update intake record
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

    // Check permission — intake requires case_manager+ role
    await requireCommunityPermission(supabase, user.id, project.id, 'intake', 'update');

    const body = await request.json();
    const { intake_id, ...updateFields } = body;

    if (!intake_id || typeof intake_id !== 'string') {
      return NextResponse.json({ error: 'intake_id is required' }, { status: 400 });
    }

    const validationResult = householdIntakeSchema.partial().safeParse(updateFields);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: HouseholdIntakeUpdate = {};
    if (validationResult.data.needs !== undefined) {
      updateData.needs = validationResult.data.needs as HouseholdIntakeUpdate['needs'];
    }
    if (validationResult.data.notes !== undefined) updateData.notes = validationResult.data.notes;
    if (validationResult.data.status !== undefined) updateData.status = validationResult.data.status;
    if (validationResult.data.assessed_at !== undefined) updateData.assessed_at = validationResult.data.assessed_at;

    const { data: intake, error } = await supabase
      .from('household_intake')
      .update(updateData)
      .eq('id', intake_id)
      .eq('household_id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Intake record not found' }, { status: 404 });
      }
      console.error('Error updating intake record:', error);
      return NextResponse.json({ error: 'Failed to update intake record' }, { status: 500 });
    }

    const updatedIntake = intake as HouseholdIntake;

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'intake',
      entityId: updatedIntake.id,
      data: {
        event: 'intake.updated',
        household_id: id,
        intake_id: updatedIntake.id,
        status: updatedIntake.status,
      },
      previousData: updateFields as Record<string, unknown>,
    });

    return NextResponse.json({ intake: updatedIntake });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/households/[id]/intake:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
