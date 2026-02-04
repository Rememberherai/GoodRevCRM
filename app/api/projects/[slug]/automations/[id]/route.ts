import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateAutomationSchema } from '@/lib/validators/automation';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/automations/[id] - Get single automation with recent executions
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

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: automation, error } = await supabaseAny
      .from('automations')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    // Fetch recent executions
    const { data: executions } = await supabaseAny
      .from('automation_executions')
      .select('*')
      .eq('automation_id', id)
      .order('executed_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      automation,
      recent_executions: executions ?? [],
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/automations/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/automations/[id] - Update automation
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

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Check admin role
    const { data: patchMembership } = await supabaseAny
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!patchMembership || !['owner', 'admin'].includes(patchMembership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin role required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = updateAutomationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { data: automation, error } = await supabaseAny
      .from('automations')
      .update(validationResult.data)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
      }
      console.error('Error updating automation:', error);
      return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 });
    }

    return NextResponse.json({ automation });
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/automations/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/automations/[id] - Delete automation
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

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Check admin role
    const { data: deleteMembership } = await supabaseAny
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!deleteMembership || !['owner', 'admin'].includes(deleteMembership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin role required.' },
        { status: 403 }
      );
    }

    const { error } = await supabaseAny
      .from('automations')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id);

    if (error) {
      console.error('Error deleting automation:', error);
      return NextResponse.json({ error: 'Failed to delete automation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/automations/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
