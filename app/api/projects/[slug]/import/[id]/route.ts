import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateImportJobSchema } from '@/lib/validators/import-export';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/import/[id] - Get import job
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
      .from('import_jobs')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Import job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/import/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/import/[id] - Update import job
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
    const validationResult = updateImportJobSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
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
      .from('import_jobs')
      .update(updates)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating import job:', error);
      return NextResponse.json({ error: 'Failed to update import job' }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: 'Import job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/import/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/import/[id] - Cancel import job
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

    // Can only cancel pending or processing jobs
    const { data: job, error } = await supabaseAny
      .from('import_jobs')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('project_id', project.id)
      .in('status', ['pending', 'validating', 'processing'])
      .select()
      .single();

    if (error || !job) {
      return NextResponse.json(
        { error: 'Import job not found or cannot be cancelled' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/import/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
