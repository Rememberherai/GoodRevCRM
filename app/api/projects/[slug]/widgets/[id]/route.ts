import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateWidgetSchema } from '@/lib/validators/report';

// GET /api/projects/[slug]/widgets/[id] - Get widget details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get widget (only if owned by user) - use any for dynamic table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: widget, error: widgetError } = await (supabase as any)
      .from('dashboard_widgets')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (widgetError || !widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    return NextResponse.json(widget);
  } catch (error) {
    console.error('Error fetching widget:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/widgets/[id] - Update widget
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse and validate body
    const body = await request.json();
    const validationResult = updateWidgetSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Update widget (only if owned by user)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: widget, error: updateError } = await (supabase as any)
      .from('dashboard_widgets')
      .update(validationResult.data)
      .eq('id', id)
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating widget:', updateError);
      return NextResponse.json({ error: 'Failed to update widget' }, { status: 500 });
    }

    if (!widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    return NextResponse.json(widget);
  } catch (error) {
    console.error('Error updating widget:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/widgets/[id] - Delete widget
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Delete widget (only if owned by user)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('dashboard_widgets')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting widget:', deleteError);
      return NextResponse.json({ error: 'Failed to delete widget' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting widget:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
