import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateOpportunitySchema } from '@/lib/validators/opportunity';
import type { Database } from '@/types/database';

type OpportunityUpdate = Database['public']['Tables']['opportunities']['Update'];
type Opportunity = Database['public']['Tables']['opportunities']['Row'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/opportunities/[id] - Get single opportunity
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

    // Fetch opportunity with related data
    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .select(`
        *,
        organizations (
          id,
          name,
          domain,
          logo_url
        ),
        people!opportunities_primary_contact_id_fkey (
          id,
          first_name,
          last_name,
          email,
          avatar_url
        )
      `)
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (error || !opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    // Transform the response to match expected shape
    const { organizations, people, ...oppData } = opportunity as any;

    return NextResponse.json({
      opportunity: {
        ...oppData,
        organization: organizations ?? null,
        primary_contact: people ?? null,
      } as Opportunity & {
        organization: any;
        primary_contact: any;
      },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/opportunities/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/opportunities/[id] - Update opportunity
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
    const validationResult = updateOpportunitySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    // Build the update object
    const updateData: OpportunityUpdate = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.stage !== undefined) updateData.stage = updates.stage;
    if (updates.amount !== undefined) updateData.amount = updates.amount;
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.probability !== undefined) updateData.probability = updates.probability;
    if (updates.expected_close_date !== undefined) updateData.expected_close_date = updates.expected_close_date;
    if (updates.actual_close_date !== undefined) updateData.actual_close_date = updates.actual_close_date;
    if (updates.organization_id !== undefined) updateData.organization_id = updates.organization_id;
    if (updates.primary_contact_id !== undefined) updateData.primary_contact_id = updates.primary_contact_id;
    if (updates.owner_id !== undefined) updateData.owner_id = updates.owner_id;
    if (updates.lost_reason !== undefined) updateData.lost_reason = updates.lost_reason;
    if (updates.won_reason !== undefined) updateData.won_reason = updates.won_reason;
    if (updates.competitor !== undefined) updateData.competitor = updates.competitor;
    if (updates.source !== undefined) updateData.source = updates.source;
    if (updates.campaign !== undefined) updateData.campaign = updates.campaign;
    if (updates.custom_fields !== undefined) {
      updateData.custom_fields = updates.custom_fields as OpportunityUpdate['custom_fields'];
    }

    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
      }
      console.error('Error updating opportunity:', error);
      return NextResponse.json({ error: 'Failed to update opportunity' }, { status: 500 });
    }

    return NextResponse.json({ opportunity: opportunity as Opportunity });
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/opportunities/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/opportunities/[id] - Soft delete opportunity
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
      .from('opportunities')
      .update({ deleted_at: new Date().toISOString() } as OpportunityUpdate)
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null);

    if (error) {
      console.error('Error deleting opportunity:', error);
      return NextResponse.json({ error: 'Failed to delete opportunity' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/opportunities/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
