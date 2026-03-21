import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { householdMemberSchema } from '@/lib/validators/community/households';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type HouseholdMemberInsert = Database['public']['Tables']['household_members']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/households/[id]/members - List members of household
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
    await requireCommunityPermission(supabase, user.id, project.id, 'households', 'view');

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

    // Fetch members with joined person data
    const { data: members, error } = await supabase
      .from('household_members')
      .select('*, person:people(id, first_name, last_name, email)')
      .eq('household_id', id)
      .order('is_primary_contact', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching household members:', error);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    return NextResponse.json({ members: members ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/households/[id]/members:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/households/[id]/members - Add member to household
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

    // Check permission
    await requireCommunityPermission(supabase, user.id, project.id, 'households', 'update');

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
    const validationResult = householdMemberSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const memberData: HouseholdMemberInsert = {
      household_id: id,
      person_id: validationResult.data.person_id,
      relationship: validationResult.data.relationship,
      is_primary_contact: validationResult.data.is_primary_contact ?? false,
      start_date: validationResult.data.start_date,
      end_date: validationResult.data.end_date ?? null,
    };

    const { data: member, error } = await supabase
      .from('household_members')
      .insert(memberData)
      .select('*, person:people(id, first_name, last_name, email)')
      .single();

    if (error) {
      console.error('Error adding household member:', error);
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
    }

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'household.member_added' as never,
      entityType: 'household_member',
      entityId: member.id,
      data: {
        household_id: id,
        person_id: validationResult.data.person_id,
        relationship: validationResult.data.relationship,
      },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/households/[id]/members:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/households/[id]/members - Remove member from household
export async function DELETE(request: Request, context: RouteContext) {
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
    const { person_id } = body;

    if (!person_id || typeof person_id !== 'string') {
      return NextResponse.json({ error: 'person_id is required' }, { status: 400 });
    }

    // Hard delete from junction table — select id first for automation event
    const { data: deleted, error } = await supabase
      .from('household_members')
      .delete()
      .eq('household_id', id)
      .eq('person_id', person_id)
      .select('id')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Member not found in household' }, { status: 404 });
      }
      console.error('Error removing household member:', error);
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'household_member',
      entityId: deleted.id,
      data: {
        event: 'household.member_removed',
        household_id: id,
        person_id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/projects/[slug]/households/[id]/members:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
