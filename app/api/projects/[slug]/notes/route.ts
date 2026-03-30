import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createNoteSchema, noteQuerySchema } from '@/lib/validators/note';
import { ensureProjectEntity } from '@/lib/community/ops';
import { canAccessCommunityResource, getProjectMembershipRole } from '@/lib/community/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/notes - List notes
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

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const membershipRole = await getProjectMembershipRole(supabase, user.id, project.id);
    if (!membershipRole) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const queryResult = noteQuerySchema.safeParse({
      person_id: searchParams.get('person_id') ?? undefined,
      organization_id: searchParams.get('organization_id') ?? undefined,
      opportunity_id: searchParams.get('opportunity_id') ?? undefined,
      rfp_id: searchParams.get('rfp_id') ?? undefined,
      household_id: searchParams.get('household_id') ?? undefined,
      case_id: searchParams.get('case_id') ?? undefined,
      incident_id: searchParams.get('incident_id') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { person_id, organization_id, opportunity_id, rfp_id, household_id, case_id, incident_id, category, limit, offset } = queryResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    const canViewCases = await canAccessCommunityResource(supabase, user.id, project.id, 'cases', 'view');
    const canViewIncidents = await canAccessCommunityResource(supabase, user.id, project.id, 'incidents', 'view');

    if (case_id && !canViewCases) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (incident_id && !canViewIncidents) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let query = supabaseAny
      .from('notes')
      .select('*, author:users!notes_created_by_fkey(id, full_name, email, avatar_url)')
      .eq('project_id', project.id);

    if (person_id) query = query.eq('person_id', person_id);
    if (organization_id) query = query.eq('organization_id', organization_id);
    if (opportunity_id) query = query.eq('opportunity_id', opportunity_id);
    if (rfp_id) query = query.eq('rfp_id', rfp_id);
    if (household_id) query = query.eq('household_id', household_id);
    if (case_id) query = query.eq('case_id', case_id);
    if (incident_id) query = query.eq('incident_id', incident_id);
    if (category) query = query.eq('category', category);
    if (!case_id && !canViewCases) query = query.is('case_id', null);
    if (!incident_id && !canViewIncidents) query = query.is('incident_id', null);

    const { data: notes, error } = await query
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching notes:', error);
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    return NextResponse.json({
      notes: notes ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/notes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/notes - Create note
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

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const membershipRole = await getProjectMembershipRole(supabase, user.id, project.id);
    if (!membershipRole) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = createNoteSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { person_id, organization_id, opportunity_id, rfp_id, household_id, case_id, incident_id } = validationResult.data;

    // Validate that referenced entities belong to this project
    if (person_id) {
      const { data: person } = await supabase
        .from('people')
        .select('id')
        .eq('id', person_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!person) {
        return NextResponse.json({ error: 'Person not found in this project' }, { status: 400 });
      }
    }
    if (organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', organization_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!org) {
        return NextResponse.json({ error: 'Organization not found in this project' }, { status: 400 });
      }
    }
    if (opportunity_id) {
      const { data: opp } = await supabase
        .from('opportunities')
        .select('id')
        .eq('id', opportunity_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!opp) {
        return NextResponse.json({ error: 'Opportunity not found in this project' }, { status: 400 });
      }
    }
    if (rfp_id) {
      const { data: rfp } = await supabase
        .from('rfps')
        .select('id')
        .eq('id', rfp_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!rfp) {
        return NextResponse.json({ error: 'RFP not found in this project' }, { status: 400 });
      }
    }

    if (household_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exists = await ensureProjectEntity(supabase as any, 'households', household_id, project.id);
      if (!exists) {
        return NextResponse.json({ error: 'Household not found in this project' }, { status: 400 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    let inferredHouseholdId = household_id ?? null;

    if (case_id) {
      const canCreateCaseNotes = await canAccessCommunityResource(supabase, user.id, project.id, 'cases', 'create');
      if (!canCreateCaseNotes) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const { data: caseRecord } = await supabaseAny
        .from('household_cases')
        .select('id, household_id')
        .eq('project_id', project.id)
        .eq('id', case_id)
        .single();
      if (!caseRecord) {
        return NextResponse.json({ error: 'Case not found in this project' }, { status: 400 });
      }
      if (inferredHouseholdId && caseRecord.household_id && inferredHouseholdId !== caseRecord.household_id) {
        return NextResponse.json(
          { error: 'household_id must match the household linked to case_id' },
          { status: 400 }
        );
      }
      inferredHouseholdId = inferredHouseholdId ?? caseRecord.household_id;
    }

    if (incident_id) {
      const canCreateIncidentNotes = await canAccessCommunityResource(supabase, user.id, project.id, 'incidents', 'create');
      if (!canCreateIncidentNotes) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const { data: incidentRecord } = await supabaseAny
        .from('incidents')
        .select('id, household_id')
        .eq('project_id', project.id)
        .eq('id', incident_id)
        .single();
      if (!incidentRecord) {
        return NextResponse.json({ error: 'Incident not found in this project' }, { status: 400 });
      }
      if (inferredHouseholdId && incidentRecord.household_id && inferredHouseholdId !== incidentRecord.household_id) {
        return NextResponse.json(
          { error: 'household_id must match the household linked to incident_id' },
          { status: 400 }
        );
      }
      inferredHouseholdId = inferredHouseholdId ?? incidentRecord.household_id ?? null;
    }

    const { data: note, error } = await supabaseAny
      .from('notes')
      .insert({
        project_id: project.id,
        ...validationResult.data,
        household_id: inferredHouseholdId,
        created_by: user.id,
      })
      .select('*, author:users!notes_created_by_fkey(id, full_name, email, avatar_url)')
      .single();

    if (error) {
      console.error('Error creating note:', error);
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/notes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
