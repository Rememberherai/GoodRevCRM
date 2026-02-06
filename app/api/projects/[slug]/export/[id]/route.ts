import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateExportJobSchema } from '@/lib/validators/import-export';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/export/[id] - Get export job
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

    const { data: job, error } = await supabaseAny
      .from('export_jobs')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Export job not found' }, { status: 404 });
    }

    // Check if expired — update DB so list endpoint stays consistent
    if (job.expires_at && new Date(job.expires_at) < new Date()) {
      await supabaseAny
        .from('export_jobs')
        .update({ status: 'expired', file_url: null })
        .eq('id', id)
        .eq('project_id', project.id);

      return NextResponse.json({
        ...job,
        status: 'expired',
        file_url: null,
      });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/export/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/export/[id] - Update export job
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

    const body = await request.json();
    const validationResult = updateExportJobSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Validate file_url against expected storage domain
    if (validationResult.data.file_url) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || !validationResult.data.file_url.startsWith(supabaseUrl)) {
        return NextResponse.json(
          { error: 'file_url must point to the application storage domain' },
          { status: 400 }
        );
      }
    }

    // Cap expires_at to max 7 days from now
    if (validationResult.data.expires_at) {
      const maxExpiry = new Date();
      maxExpiry.setDate(maxExpiry.getDate() + 7);
      if (new Date(validationResult.data.expires_at) > maxExpiry) {
        return NextResponse.json(
          { error: 'expires_at cannot be more than 7 days from now' },
          { status: 400 }
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Build update object
    const updates: Record<string, unknown> = { ...validationResult.data };

    // Set timestamps based on status
    if (validationResult.data.status === 'processing' && !updates.started_at) {
      updates.started_at = new Date().toISOString();
    }
    if (
      (validationResult.data.status === 'completed' ||
        validationResult.data.status === 'failed') &&
      !updates.completed_at
    ) {
      updates.completed_at = new Date().toISOString();
    }

    const { data: job, error } = await supabaseAny
      .from('export_jobs')
      .update(updates)
      .eq('id', id)
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating export job:', error);
      return NextResponse.json({ error: 'Failed to update export job' }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: 'Export job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/export/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
