import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateRfpSchema } from '@/lib/validators/rfp';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type RfpUpdate = Database['public']['Tables']['rfps']['Update'];
type Rfp = Database['public']['Tables']['rfps']['Row'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/rfps/[id] - Get single RFP
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

    // Fetch RFP with related data
    const { data: rfp, error } = await supabase
      .from('rfps')
      .select(`
        *,
        organizations (
          id,
          name,
          domain,
          logo_url
        ),
        opportunities (
          id,
          name,
          stage,
          amount
        )
      `)
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (error || !rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    // Transform the response to match expected shape
    const { organizations, opportunities, ...rfpData } = rfp as any;

    return NextResponse.json({
      rfp: {
        ...rfpData,
        organization: organizations ?? null,
        opportunity: opportunities ?? null,
      } as Rfp & {
        organization: any;
        opportunity: any;
      },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/rfps/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/rfps/[id] - Update RFP
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
    const validationResult = updateRfpSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    // Fetch previous state for automation status change detection
    let previousStatus: string | null = null;
    if (updates.status !== undefined) {
      const { data: prev } = await supabase
        .from('rfps')
        .select('status')
        .eq('id', id)
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .single();
      previousStatus = prev?.status ?? null;
    }

    // Build the update object
    const updateData: RfpUpdate = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.rfp_number !== undefined) updateData.rfp_number = updates.rfp_number;
    if (updates.organization_id !== undefined) updateData.organization_id = updates.organization_id;
    if (updates.opportunity_id !== undefined) updateData.opportunity_id = updates.opportunity_id;
    if (updates.owner_id !== undefined) updateData.owner_id = updates.owner_id;
    if (updates.issue_date !== undefined) updateData.issue_date = updates.issue_date;
    if (updates.due_date !== undefined) updateData.due_date = updates.due_date;
    if (updates.questions_due_date !== undefined) updateData.questions_due_date = updates.questions_due_date;
    if (updates.decision_date !== undefined) updateData.decision_date = updates.decision_date;
    if (updates.estimated_value !== undefined) updateData.estimated_value = updates.estimated_value;
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.budget_range !== undefined) updateData.budget_range = updates.budget_range;
    if (updates.submission_method !== undefined) updateData.submission_method = updates.submission_method;
    if (updates.submission_portal_url !== undefined) updateData.submission_portal_url = updates.submission_portal_url;
    if (updates.submission_email !== undefined) updateData.submission_email = updates.submission_email;
    if (updates.submission_instructions !== undefined) updateData.submission_instructions = updates.submission_instructions;
    if (updates.win_probability !== undefined) updateData.win_probability = updates.win_probability;
    if (updates.go_no_go_decision !== undefined) updateData.go_no_go_decision = updates.go_no_go_decision;
    if (updates.go_no_go_date !== undefined) updateData.go_no_go_date = updates.go_no_go_date;
    if (updates.go_no_go_notes !== undefined) updateData.go_no_go_notes = updates.go_no_go_notes;
    if (updates.outcome_reason !== undefined) updateData.outcome_reason = updates.outcome_reason;
    if (updates.feedback !== undefined) updateData.feedback = updates.feedback;
    if (updates.awarded_to !== undefined) updateData.awarded_to = updates.awarded_to;
    if (updates.rfp_document_url !== undefined) updateData.rfp_document_url = updates.rfp_document_url;
    if (updates.response_document_url !== undefined) updateData.response_document_url = updates.response_document_url;
    if (updates.custom_fields !== undefined) {
      updateData.custom_fields = updates.custom_fields as RfpUpdate['custom_fields'];
    }

    const { data: rfp, error } = await supabase
      .from('rfps')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
      }
      console.error('Error updating RFP:', error);
      return NextResponse.json({ error: 'Failed to update RFP' }, { status: 500 });
    }

    // Emit automation events
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'rfp',
      entityId: id,
      data: rfp as Record<string, unknown>,
      previousData: { status: previousStatus },
    });

    // Emit status change event if status actually changed
    if (updates.status && previousStatus && updates.status !== previousStatus) {
      emitAutomationEvent({
        projectId: project.id,
        triggerType: 'rfp.status_changed',
        entityType: 'rfp',
        entityId: id,
        data: rfp as Record<string, unknown>,
        previousData: { status: previousStatus },
      });
    }

    return NextResponse.json({ rfp: rfp as Rfp });
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/rfps/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/rfps/[id] - Soft delete RFP
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
      .from('rfps')
      .update({ deleted_at: new Date().toISOString() } as RfpUpdate)
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null);

    if (error) {
      console.error('Error deleting RFP:', error);
      return NextResponse.json({ error: 'Failed to delete RFP' }, { status: 500 });
    }

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'rfp',
      entityId: id,
      data: { id, project_id: project.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/rfps/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
