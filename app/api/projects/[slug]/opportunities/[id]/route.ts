import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateOpportunitySchema } from '@/lib/validators/opportunity';
import { emitAutomationEvent } from '@/lib/automations/engine';
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

    // Fetch linked RFPs for this opportunity
    const { data: rfps } = await supabase
      .from('rfps')
      .select('id, title, status, due_date, estimated_value')
      .eq('opportunity_id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Transform the response to match expected shape
    const { organizations, people, ...oppData } = opportunity as any;

    return NextResponse.json({
      opportunity: {
        ...oppData,
        organization: organizations ?? null,
        primary_contact: people ?? null,
        rfps: rfps ?? [],
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

    // Validate cross-project references
    if (updates.organization_id !== undefined && updates.organization_id !== null) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', updates.organization_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!org) {
        return NextResponse.json({ error: 'Organization not found in this project' }, { status: 400 });
      }
    }
    if (updates.primary_contact_id !== undefined && updates.primary_contact_id !== null) {
      const { data: contact } = await supabase
        .from('people')
        .select('id')
        .eq('id', updates.primary_contact_id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      if (!contact) {
        return NextResponse.json({ error: 'Contact not found in this project' }, { status: 400 });
      }
    }
    if (updates.owner_id !== undefined && updates.owner_id !== null) {
      const { data: member } = await supabase
        .from('project_memberships')
        .select('user_id')
        .eq('user_id', updates.owner_id)
        .eq('project_id', project.id)
        .single();
      if (!member) {
        return NextResponse.json({ error: 'Owner is not a member of this project' }, { status: 400 });
      }
    }

    // Fetch previous state for automation stage change detection
    let previousStage: string | null = null;
    if (updates.stage !== undefined) {
      const { data: prev } = await supabase
        .from('opportunities')
        .select('stage')
        .eq('id', id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      previousStage = prev?.stage ?? null;
    }

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

    // Emit automation events
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'opportunity',
      entityId: id,
      data: opportunity as Record<string, unknown>,
      previousData: { stage: previousStage },
    });

    // Emit stage change event if stage actually changed
    if (updates.stage !== undefined && updates.stage !== previousStage) {
      emitAutomationEvent({
        projectId: project.id,
        triggerType: 'opportunity.stage_changed',
        entityType: 'opportunity',
        entityId: id,
        data: opportunity as Record<string, unknown>,
        previousData: { stage: previousStage },
      });
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
    const { data: _deleted, error } = await supabase
      .from('opportunities')
      .update({ deleted_at: new Date().toISOString() } as OpportunityUpdate)
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .select('id')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
      }
      console.error('Error deleting opportunity:', error);
      return NextResponse.json({ error: 'Failed to delete opportunity' }, { status: 500 });
    }

    // Emit automation event only if a row was actually deleted
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'opportunity',
      entityId: id,
      data: { id, project_id: project.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/opportunities/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
