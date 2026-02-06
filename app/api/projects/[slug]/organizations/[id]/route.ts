import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateOrganizationSchema } from '@/lib/validators/organization';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type OrganizationUpdate = Database['public']['Tables']['organizations']['Update'];
type Organization = Database['public']['Tables']['organizations']['Row'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/organizations/[id] - Get single organization
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

    // Fetch organization with related counts
    const { data: organization, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (error || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get related counts
    const [peopleResult, oppsResult] = await Promise.all([
      supabase
        .from('person_organizations')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', id)
        .eq('project_id', project.id),
      supabase
        .from('opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', id)
        .eq('project_id', project.id)
        .is('deleted_at', null),
    ]);

    return NextResponse.json({
      organization: {
        ...organization,
        people_count: peopleResult.count ?? 0,
        opportunities_count: oppsResult.count ?? 0,
      } as Organization & { people_count: number; opportunities_count: number },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/organizations/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/organizations/[id] - Update organization
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
    const validationResult = updateOrganizationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    // Build the update object
    const updateData: OrganizationUpdate = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.domain !== undefined) updateData.domain = updates.domain;
    if (updates.website !== undefined) updateData.website = updates.website;
    if (updates.industry !== undefined) updateData.industry = updates.industry;
    if (updates.employee_count !== undefined) updateData.employee_count = updates.employee_count;
    if (updates.annual_revenue !== undefined) updateData.annual_revenue = updates.annual_revenue;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.logo_url !== undefined) updateData.logo_url = updates.logo_url;
    if (updates.linkedin_url !== undefined) updateData.linkedin_url = updates.linkedin_url;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.address_street !== undefined) updateData.address_street = updates.address_street;
    if (updates.address_city !== undefined) updateData.address_city = updates.address_city;
    if (updates.address_state !== undefined) updateData.address_state = updates.address_state;
    if (updates.address_postal_code !== undefined) updateData.address_postal_code = updates.address_postal_code;
    if (updates.address_country !== undefined) updateData.address_country = updates.address_country;
    if (updates.custom_fields !== undefined) {
      updateData.custom_fields = updates.custom_fields as OrganizationUpdate['custom_fields'];
    }

    const { data: organization, error } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }
      console.error('Error updating organization:', error);
      return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
    }

    // Emit automation events
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'organization',
      entityId: id,
      data: organization as Record<string, unknown>,
      previousData: updates as Record<string, unknown>,
    });

    // Emit field.changed for each updated field
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        emitAutomationEvent({
          projectId: project.id,
          triggerType: 'field.changed',
          entityType: 'organization',
          entityId: id,
          data: organization as Record<string, unknown>,
          previousData: { [key]: undefined },
        });
      }
    }

    // Update news keyword if org name changed (fire-and-forget)
    if (updates.name && updates.name.length >= 3) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('news_keywords')
        .upsert(
          {
            project_id: project.id,
            keyword: updates.name,
            source: 'organization',
            organization_id: id,
            is_active: true,
            created_by: user.id,
          },
          { onConflict: 'project_id,keyword' }
        )
        .then(({ error: kwError }: { error: { message: string } | null }) => {
          if (kwError) console.warn('[News] Auto-keyword update failed:', kwError.message);
        });
    }

    return NextResponse.json({ organization: organization as Organization });
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/organizations/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/organizations/[id] - Soft delete organization
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
      .from('organizations')
      .update({ deleted_at: new Date().toISOString() } as OrganizationUpdate)
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .select('id')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }
      console.error('Error deleting organization:', error);
      return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 });
    }

    // Remove news keyword for this org (fire-and-forget)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('news_keywords')
      .delete()
      .eq('organization_id', id)
      .eq('project_id', project.id)
      .then(({ error: kwError }: { error: { message: string } | null }) => {
        if (kwError) console.warn('[News] Auto-keyword deletion failed:', kwError.message);
      });

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'organization',
      entityId: id,
      data: { id, project_id: project.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/organizations/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
