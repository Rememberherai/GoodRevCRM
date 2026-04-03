import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createPersonSchema } from '@/lib/validators/person';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { detectDuplicates } from '@/lib/deduplication';
import { getDefaultDisposition } from '@/lib/dispositions/service';
import { parseFiltersParam, applyDirectFilters, resolveOrgRelationFilters, ALLOWED_PEOPLE_FIELDS } from '@/lib/filters/apply-filters';
import type { Database } from '@/types/database';

type PersonInsert = Database['public']['Tables']['people']['Insert'];
type Person = Database['public']['Tables']['people']['Row'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

function sanitizePersonForResponse(person: Record<string, unknown>) {
  const { kiosk_pin_hmac, ...rest } = person;
  return {
    ...rest,
    pin_set: kiosk_pin_hmac != null,
  };
}

// GET /api/projects/[slug]/people - List people
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const idsOnly = searchParams.get('fields') === 'id';
    const maxLimit = idsOnly ? 10000 : 100;
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), maxLimit);
    const search = searchParams.get('search') ?? '';
    const sortBy = searchParams.get('sortBy') ?? 'created_at';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';
    const organizationId = searchParams.get('organizationId');
    const isContractor = searchParams.get('is_contractor');
    const isEmployee = searchParams.get('is_employee');
    const householdless = searchParams.get('householdless');
    const advancedFilters = parseFiltersParam(searchParams.get('filters'));

    const offset = (page - 1) * limit;

    // Build query — select only ID when requested for bulk selection
    let query = supabase
      .from('people')
      .select(idsOnly ? 'id' : '*, disposition:dispositions(id, name, color, blocks_outreach)', { count: 'exact' })
      .eq('project_id', project.id)
      .is('deleted_at', null);

    // Apply search filter
    if (search) {
      const sanitized = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
      query = query.or(
        `first_name.ilike."%${sanitized}%",last_name.ilike."%${sanitized}%",email.ilike."%${sanitized}%",job_title.ilike."%${sanitized}%"`
      );
    }

    // Filter by organization if provided
    if (organizationId) {
      const { data: personIds } = await supabase
        .from('person_organizations')
        .select('person_id')
        .eq('organization_id', organizationId)
        .eq('project_id', project.id);

      if (personIds && personIds.length > 0) {
        query = query.in(
          'id',
          personIds.map((p: { person_id: string }) => p.person_id)
        );
      } else {
        // No people in this organization
        return NextResponse.json({
          people: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }
    }

    // Filter to only people NOT in any active household membership
    if (householdless === 'true') {
      // Get person IDs who are active household members (scoped to project's households)
      const { data: projectHouseholds } = await supabase
        .from('households')
        .select('id')
        .eq('project_id', project.id)
        .is('deleted_at', null);

      if (projectHouseholds && projectHouseholds.length > 0) {
        const { data: housedPersonIds } = await supabase
          .from('household_members')
          .select('person_id')
          .in('household_id', projectHouseholds.map(h => h.id))
          .is('end_date', null);

        if (housedPersonIds && housedPersonIds.length > 0) {
          const housedIds = [...new Set(housedPersonIds.map((m: { person_id: string }) => m.person_id))];
          query = query.not('id', 'in', `(${housedIds.join(',')})`);
        }
      }
      // If no households or no members, no filtering needed — all are householdless
    }

    if (isContractor === 'true') {
      query = query.eq('is_contractor', true);
    } else if (isContractor === 'false') {
      query = query.eq('is_contractor', false);
    }

    if (isEmployee === 'true') {
      query = query.eq('is_employee', true);
    } else if (isEmployee === 'false') {
      query = query.eq('is_employee', false);
    }

    // Apply advanced filters
    if (advancedFilters.length > 0) {
      query = applyDirectFilters(query, advancedFilters, ALLOWED_PEOPLE_FIELDS);

      // Handle cross-entity org filters
      const personIdsFromOrg = await resolveOrgRelationFilters(supabase, project.id, advancedFilters);
      if (personIdsFromOrg !== null) {
        if (personIdsFromOrg.length === 0) {
          return NextResponse.json({
            people: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
          });
        }
        query = query.in('id', personIdsFromOrg);
      }
    }

    // Apply sorting
    const ALLOWED_SORT_COLUMNS = ['first_name', 'last_name', 'email', 'created_at', 'updated_at', 'job_title', 'disposition_id'];
    const ascending = sortOrder === 'asc';
    if (ALLOWED_SORT_COLUMNS.includes(sortBy)) {
      query = query.order(sortBy, { ascending });
    } else {
      query = query.order('created_at', { ascending });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: people, error, count } = await query;

    if (error) {
      console.error('Error fetching people:', error);
      return NextResponse.json({ error: 'Failed to fetch people' }, { status: 500 });
    }

    // Attach household info to each person (skip for id-only queries)
    let enrichedPeople = people as unknown as Record<string, unknown>[];
    if (!idsOnly && people && people.length > 0) {
      const personIds = (people as unknown as Person[]).map(p => p.id);
      const { data: memberships } = await supabase
        .from('household_members')
        .select('person_id, household:households(id, name)')
        .in('person_id', personIds)
        .is('end_date', null);

      if (memberships && memberships.length > 0) {
        const householdByPerson = new Map<string, { id: string; name: string }>();
        for (const m of memberships) {
          const hh = m.household as unknown as { id: string; name: string } | null;
          if (hh && !householdByPerson.has(m.person_id)) {
            householdByPerson.set(m.person_id, hh);
          }
        }
        enrichedPeople = (people as unknown as Record<string, unknown>[]).map(p => ({
          ...p,
          household: householdByPerson.get((p as unknown as Person).id) ?? null,
        }));
      }
    }

    return NextResponse.json({
      people: idsOnly ? enrichedPeople : enrichedPeople.map(sanitizePersonForResponse),
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/people:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/people - Create person
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

    const body = await request.json();
    const {
      organization_id,
      household_id,
      household_relationship,
      household_is_primary_contact,
      new_household,
      ...personFields
    } = body;
    const validationResult = createPersonSchema.safeParse(personFields);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Check for duplicates unless force_create is set
    const forceCreate = body.force_create === true;
    if (!forceCreate) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: settings } = await (supabase as any)
        .from('dedup_settings')
        .select('min_match_threshold')
        .eq('project_id', project.id)
        .single();

      const minThreshold = settings?.min_match_threshold ? Number(settings.min_match_threshold) : undefined;

      const dupResult = await detectDuplicates(
        {
          email: validationResult.data.email,
          first_name: validationResult.data.first_name,
          last_name: validationResult.data.last_name,
          phone: validationResult.data.phone,
          mobile_phone: validationResult.data.mobile_phone,
          linkedin_url: validationResult.data.linkedin_url,
        },
        { entityType: 'person', projectId: project.id, minThreshold },
        supabase
      );

      if (dupResult.has_duplicates) {
        return NextResponse.json(
          {
            duplicates_detected: true,
            matches: dupResult.matches,
            pending_record: validationResult.data,
          },
          { status: 409 }
        );
      }
    }

    // Auto-assign default disposition if none provided
    let dispositionId = validationResult.data.disposition_id ?? null;
    if (!dispositionId) {
      const defaultDisp = await getDefaultDisposition(
        { supabase, projectId: project.id, userId: user.id },
        'person'
      );
      if (defaultDisp) dispositionId = defaultDisp.id;
    }

    const personData: PersonInsert = {
      ...validationResult.data,
      disposition_id: dispositionId,
      project_id: project.id,
      created_by: user.id,
      custom_fields: validationResult.data.custom_fields as PersonInsert['custom_fields'],
    };

    const { data: person, error } = await supabase
      .from('people')
      .insert(personData)
      .select()
      .single();

    if (error) {
      console.error('Error creating person:', error);
      return NextResponse.json({ error: 'Failed to create person' }, { status: 500 });
    }

    // If organization_id is provided, create the person-organization link
    if (organization_id && typeof organization_id === 'string' && person) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', organization_id)
        .eq('project_id', project.id)
        .single();

      if (org) {
        const { error: linkError } = await supabase
          .from('person_organizations')
          .insert({
            person_id: (person as Person).id,
            organization_id: organization_id,
            project_id: project.id,
            is_primary: true,
          });

        if (linkError) {
          console.error('Error linking person to organization:', linkError);
        }
      }
    }

    // If household_id is provided, link person to existing household
    if (household_id && typeof household_id === 'string' && person) {
      try {
        const { data: hh } = await supabase
          .from('households')
          .select('id')
          .eq('id', household_id)
          .eq('project_id', project.id)
          .is('deleted_at', null)
          .single();

        if (hh) {
          const rel: string = household_relationship || 'other';
          const { error: memberError } = await supabase
            .from('household_members')
            .insert({
              household_id: household_id as string,
              person_id: (person as Person).id,
              relationship: rel,
              is_primary_contact: household_is_primary_contact === true,
              start_date: new Date().toISOString().split('T')[0],
            } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

          if (memberError) {
            console.error('Error linking person to household:', memberError);
          }
        }
      } catch (hhErr) {
        console.error('Error linking person to household:', hhErr);
      }
    }

    // If new_household is provided, create household then link person
    if (new_household && typeof new_household === 'object' && new_household.name && person) {
      try {
        const { data: createdHousehold, error: hhCreateError } = await supabase
          .from('households')
          .insert({
            project_id: project.id,
            created_by: user.id,
            name: new_household.name,
            address_street: new_household.address_street || null,
            address_city: new_household.address_city || null,
            address_state: new_household.address_state || null,
            address_postal_code: new_household.address_postal_code || null,
            geocoded_status: 'pending',
          })
          .select('id')
          .single();

        if (hhCreateError) {
          console.error('Error creating household for person:', hhCreateError);
        } else if (createdHousehold) {
          const rel: string = household_relationship || 'head_of_household';
          const { error: memberError } = await supabase
            .from('household_members')
            .insert({
              household_id: createdHousehold.id,
              person_id: (person as Person).id,
              relationship: rel,
              is_primary_contact: household_is_primary_contact === true,
              start_date: new Date().toISOString().split('T')[0],
            } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

          if (memberError) {
            console.error('Error linking person to new household:', memberError);
          }

          emitAutomationEvent({
            projectId: project.id,
            triggerType: 'household.created' as never,
            entityType: 'household',
            entityId: createdHousehold.id,
            data: { id: createdHousehold.id, name: new_household.name },
          });
        }
      } catch (hhErr) {
        console.error('Error creating household for person:', hhErr);
      }
    }

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created',
      entityType: 'person',
      entityId: (person as Person).id,
      data: person as Record<string, unknown>,
    });

    return NextResponse.json({ person: person as Person }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/people:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
