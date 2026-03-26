import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { eventCalendarSettingsSchema } from '@/lib/validators/event';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'view');

    const { data: settings } = await supabase
      .from('event_calendar_settings')
      .select('*')
      .eq('project_id', project.id)
      .maybeSingle();

    return NextResponse.json({ settings: settings ?? null });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in GET calendar-settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'manage');

    const body = await request.json();
    const validationResult = eventCalendarSettingsSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const validated = validationResult.data;

    // Check if this is initial setup (no existing settings) — slug is required
    const { data: existing } = await supabase
      .from('event_calendar_settings')
      .select('id')
      .eq('project_id', project.id)
      .maybeSingle();

    if (!existing && !validated.slug) {
      return NextResponse.json({ error: 'Slug is required for initial setup' }, { status: 400 });
    }

    // Use upsert to avoid TOCTOU race condition
    let settings;
    let error;

    if (existing) {
      const result = await supabase
        .from('event_calendar_settings')
        .update(validated)
        .eq('project_id', project.id)
        .select()
        .single();
      settings = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from('event_calendar_settings')
        .insert({
          ...validated,
          project_id: project.id,
          slug: validated.slug!,
          title: validated.title ?? 'Events',
        })
        .select()
        .single();
      settings = result.data;
      error = result.error;
    }

    if (error) {
      // Handle race condition: concurrent insert on same project_id
      if (error.code === '23505' && error.message.includes('project_id') && !existing) {
        // Another request created the row first — retry as update
        const retryResult = await supabase
          .from('event_calendar_settings')
          .update(validated)
          .eq('project_id', project.id)
          .select()
          .single();
        if (!retryResult.error) {
          return NextResponse.json({ settings: retryResult.data });
        }
      }
      if (error.code === '23505' && error.message.includes('slug')) {
        return NextResponse.json({ error: 'Calendar slug is already in use' }, { status: 409 });
      }
      console.error('Error updating calendar settings:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in PUT calendar-settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
