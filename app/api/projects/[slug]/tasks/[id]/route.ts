import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateTaskSchema } from '@/lib/validators/task';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/tasks/[id] - Get task
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

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: task, error } = await supabaseAny
      .from('tasks')
      .select('*, assigned_user:users!tasks_assigned_to_fkey(id, full_name, email)')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/tasks/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/tasks/[id] - Update task
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

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const validationResult = updateTaskSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Validate assigned_to is a project member
    if (validationResult.data.assigned_to) {
      const { data: member } = await supabase
        .from('project_memberships')
        .select('id')
        .eq('project_id', project.id)
        .eq('user_id', validationResult.data.assigned_to)
        .single();
      if (!member) {
        return NextResponse.json(
          { error: 'assigned_to must be a member of this project' },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      ...validationResult.data,
      updated_at: new Date().toISOString(),
    };

    // Auto-set completed_at when status changes to completed
    if (validationResult.data.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else if (validationResult.data.status) {
      updateData.completed_at = null;
    }

    const { data: task, error } = await supabaseAny
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Emit automation events
    if (validationResult.data.status === 'completed') {
      emitAutomationEvent({
        projectId: project.id,
        triggerType: 'task.completed',
        entityType: 'task',
        entityId: id,
        data: task as Record<string, unknown>,
      });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'task',
      entityId: id,
      data: task as Record<string, unknown>,
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/tasks/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/tasks/[id] - Delete task
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

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { data: deletedTask, error } = await supabaseAny
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error || !deletedTask) {
      if (error?.code === 'PGRST116' || !deletedTask) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      console.error('Error deleting task:', error);
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'task',
      entityId: id,
      data: deletedTask as Record<string, unknown>,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/tasks/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
