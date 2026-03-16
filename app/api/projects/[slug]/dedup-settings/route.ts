import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const updateSettingsSchema = z.object({
  min_match_threshold: z.number().min(0).max(1).optional(),
  auto_merge_threshold: z.number().min(0).max(1).optional(),
});

// GET /api/projects/[slug]/dedup-settings
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
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
    const { data: settings } = await (supabase as any)
      .from('dedup_settings')
      .select('*')
      .eq('project_id', project.id)
      .single();

    // Return defaults if no settings exist
    return NextResponse.json({
      settings: settings ?? {
        project_id: project.id,
        min_match_threshold: 0.60,
        auto_merge_threshold: 0.95,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/dedup-settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/dedup-settings
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
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
    const validation = updateSettingsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings, error } = await (supabase as any)
      .from('dedup_settings')
      .upsert(
        {
          project_id: project.id,
          ...validation.data,
        },
        { onConflict: 'project_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error updating dedup settings:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/dedup-settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
