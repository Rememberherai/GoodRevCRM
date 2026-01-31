import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updatePersonSchema } from '@/lib/validators/person';
import type { Database } from '@/types/database';

type PersonUpdate = Database['public']['Tables']['people']['Update'];
type Person = Database['public']['Tables']['people']['Row'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/people/[id] - Get single person
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

    // Fetch person
    const { data: person, error } = await supabase
      .from('people')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (error || !person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Get organizations for this person
    const { data: personOrgs } = await supabase
      .from('person_organizations')
      .select(
        `
        id,
        job_title,
        department,
        is_primary,
        start_date,
        end_date,
        organization_id,
        organizations (
          id,
          name,
          domain,
          logo_url
        )
      `
      )
      .eq('person_id', id);

    // Get related counts
    const { count: oppsCount } = await supabase
      .from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('primary_contact_id', id)
      .is('deleted_at', null);

    return NextResponse.json({
      person: {
        ...person,
        organizations: personOrgs?.map((po: any) => ({
          ...po,
          organization: po.organizations,
        })) ?? [],
        organization_count: personOrgs?.length ?? 0,
        opportunities_count: oppsCount ?? 0,
      } as Person & {
        organizations: any[];
        organization_count: number;
        opportunities_count: number;
      },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/people/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/people/[id] - Update person
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

    const body = await request.json();
    const validationResult = updatePersonSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    // Build the update object
    const updateData: PersonUpdate = {};
    if (updates.first_name !== undefined) updateData.first_name = updates.first_name;
    if (updates.last_name !== undefined) updateData.last_name = updates.last_name;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.mobile_phone !== undefined) updateData.mobile_phone = updates.mobile_phone;
    if (updates.linkedin_url !== undefined) updateData.linkedin_url = updates.linkedin_url;
    if (updates.twitter_handle !== undefined) updateData.twitter_handle = updates.twitter_handle;
    if (updates.avatar_url !== undefined) updateData.avatar_url = updates.avatar_url;
    if (updates.job_title !== undefined) updateData.job_title = updates.job_title;
    if (updates.department !== undefined) updateData.department = updates.department;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.timezone !== undefined) updateData.timezone = updates.timezone;
    if (updates.preferred_contact_method !== undefined) updateData.preferred_contact_method = updates.preferred_contact_method;
    if (updates.address_street !== undefined) updateData.address_street = updates.address_street;
    if (updates.address_city !== undefined) updateData.address_city = updates.address_city;
    if (updates.address_state !== undefined) updateData.address_state = updates.address_state;
    if (updates.address_postal_code !== undefined) updateData.address_postal_code = updates.address_postal_code;
    if (updates.address_country !== undefined) updateData.address_country = updates.address_country;
    if (updates.custom_fields !== undefined) {
      updateData.custom_fields = updates.custom_fields as PersonUpdate['custom_fields'];
    }

    const { data: person, error } = await supabase
      .from('people')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Person not found' }, { status: 404 });
      }
      console.error('Error updating person:', error);
      return NextResponse.json({ error: 'Failed to update person' }, { status: 500 });
    }

    return NextResponse.json({ person: person as Person });
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/people/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/people/[id] - Soft delete person
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

    // Soft delete by setting deleted_at
    const { error } = await supabase
      .from('people')
      .update({ deleted_at: new Date().toISOString() } as PersonUpdate)
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null);

    if (error) {
      console.error('Error deleting person:', error);
      return NextResponse.json({ error: 'Failed to delete person' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/people/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
