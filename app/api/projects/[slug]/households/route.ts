import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createHouseholdSchema } from '@/lib/validators/community/households';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type HouseholdInsert = Database['public']['Tables']['households']['Insert'];
type Household = Database['public']['Tables']['households']['Row'];
type HouseholdMemberInsert = Database['public']['Tables']['household_members']['Insert'];
type HouseholdIntakeInsert = Database['public']['Tables']['household_intake']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

async function cleanupCreatedHousehold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  projectId: string
) {
  const { error } = await supabase
    .from('households')
    .delete()
    .eq('id', householdId)
    .eq('project_id', projectId);

  if (error) {
    console.error('Error cleaning up partially created household:', error);
  }
}

// GET /api/projects/[slug]/households - List households
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
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
    await requireCommunityPermission(supabase, user.id, project.id, 'households', 'view');

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const search = searchParams.get('search') ?? '';
    const sortBy = searchParams.get('sortBy') ?? 'created_at';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';

    const offset = (page - 1) * limit;

    // Build query with member count
    let query = supabase
      .from('households')
      .select('*, household_members(id)', { count: 'exact' })
      .eq('project_id', project.id)
      .is('deleted_at', null);

    // Apply search filter
    if (search) {
      const sanitized = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
      query = query.or(
        `name.ilike."%${sanitized}%",address_street.ilike."%${sanitized}%",address_city.ilike."%${sanitized}%"`
      );
    }

    // Apply sorting
    const ALLOWED_SORT_COLUMNS = [
      'name',
      'address_city',
      'address_state',
      'household_size',
      'created_at',
      'updated_at',
    ];
    const ascending = sortOrder === 'asc';
    if (ALLOWED_SORT_COLUMNS.includes(sortBy)) {
      query = query.order(sortBy, { ascending });
    } else {
      query = query.order('created_at', { ascending });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: households, error, count } = await query;

    if (error) {
      console.error('Error fetching households:', error);
      return NextResponse.json({ error: 'Failed to fetch households' }, { status: 500 });
    }

    // Map to include member_count
    const householdsWithCount = (households ?? []).map((h) => {
      const { household_members, ...rest } = h;
      return {
        ...rest,
        member_count: Array.isArray(household_members) ? household_members.length : 0,
      };
    });

    return NextResponse.json({
      households: householdsWithCount,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/households:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/households - Create household
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
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
    await requireCommunityPermission(supabase, user.id, project.id, 'households', 'create');

    const body = await request.json();
    const validationResult = createHouseholdSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { members, intake, ...householdFields } = validationResult.data;

    if (intake) {
      await requireCommunityPermission(supabase, user.id, project.id, 'intake', 'create');
    }

    const householdData: HouseholdInsert = {
      ...householdFields,
      project_id: project.id,
      created_by: user.id,
      custom_fields: householdFields.custom_fields as HouseholdInsert['custom_fields'],
    };

    const { data: household, error } = await supabase
      .from('households')
      .insert(householdData)
      .select()
      .single();

    if (error) {
      console.error('Error creating household:', error);
      return NextResponse.json({ error: 'Failed to create household' }, { status: 500 });
    }

    const createdHousehold = household as Household;

    // Insert inline members if provided
    if (members && members.length > 0) {
      const memberInserts: HouseholdMemberInsert[] = members.map((m) => ({
        household_id: createdHousehold.id,
        person_id: m.person_id,
        relationship: m.relationship,
        is_primary_contact: m.is_primary_contact ?? false,
        start_date: m.start_date,
        end_date: m.end_date ?? null,
      }));

      const { error: membersError } = await supabase
        .from('household_members')
        .insert(memberInserts);

      if (membersError) {
        console.error('Error inserting household members:', membersError);
        await cleanupCreatedHousehold(supabase, createdHousehold.id, project.id);
        return NextResponse.json(
          { error: 'Failed to create household members' },
          { status: 500 }
        );
      }
    }

    // Insert inline intake if provided
    if (intake) {
      const intakeData: HouseholdIntakeInsert = {
        household_id: createdHousehold.id,
        assessed_by: intake.assessed_by ?? user.id,
        assessed_at: intake.assessed_at ?? new Date().toISOString(),
        needs: intake.needs as HouseholdIntakeInsert['needs'],
        notes: intake.notes ?? null,
        status: intake.status ?? 'draft',
      };

      const { error: intakeError } = await supabase
        .from('household_intake')
        .insert(intakeData);

      if (intakeError) {
        console.error('Error inserting household intake:', intakeError);
        await cleanupCreatedHousehold(supabase, createdHousehold.id, project.id);
        return NextResponse.json(
          { error: 'Failed to create household intake record' },
          { status: 500 }
        );
      }
    }

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created',
      entityType: 'household',
      entityId: createdHousehold.id,
      data: createdHousehold as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ household: createdHousehold }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/households:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
