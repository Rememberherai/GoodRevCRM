import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

async function resolveProjectAndCheckAdmin(slug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) {
    return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
  }

  const { data: membership } = await supabase
    .from('project_memberships')
    .select('role')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .single();

  const isOwner = project.owner_id === user.id;
  const memberRole = (membership as { role?: string } | null)?.role;
  const isAdmin = memberRole === 'admin';

  if (!isOwner && !isAdmin) {
    return { error: NextResponse.json({ error: 'Permission denied' }, { status: 403 }) };
  }

  return { project, user };
}

const logSchema = z.object({
  templateKey: z.string(),
  durationMs: z.number(),
  httpStatus: z.number(),
  status: z.enum(['success', 'error']),
  errorMessage: z.string().optional(),
});

/**
 * POST /api/projects/[slug]/scheduler/browser-history
 * Log a browser scheduler execution result.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const result = await resolveProjectAndCheckAdmin(slug);
    if ('error' in result) return result.error;

    const body = await request.json();
    const validation = logSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { templateKey, durationMs, httpStatus, status, errorMessage } = validation.data;
    const admin = createAdminClient();

    // Insert the history entry
    const { error: insertError } = await admin
      .from('browser_scheduler_history')
      .insert({
        project_id: result.project.id,
        template_key: templateKey,
        duration_ms: durationMs,
        http_status: httpStatus,
        status,
        error_message: errorMessage ?? null,
      });

    if (insertError) {
      throw new Error(`Failed to log history: ${insertError.message}`);
    }

    // Prune old entries: keep only the most recent 50 per template
    const { data: oldEntries } = await admin
      .from('browser_scheduler_history')
      .select('id')
      .eq('project_id', result.project.id)
      .eq('template_key', templateKey)
      .order('started_at', { ascending: false })
      .range(50, 999);

    if (oldEntries && oldEntries.length > 0) {
      await admin
        .from('browser_scheduler_history')
        .delete()
        .in('id', oldEntries.map((e) => e.id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging browser scheduler history:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/projects/[slug]/scheduler/browser-history?templateKey=xxx
 * Fetch recent execution history for a template.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const result = await resolveProjectAndCheckAdmin(slug);
    if ('error' in result) return result.error;

    const { searchParams } = new URL(request.url);
    const templateKey = searchParams.get('templateKey');

    if (!templateKey) {
      return NextResponse.json({ error: 'templateKey is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('browser_scheduler_history')
      .select('id, template_key, started_at, duration_ms, http_status, status, error_message')
      .eq('project_id', result.project.id)
      .eq('template_key', templateKey)
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(`Failed to fetch history: ${error.message}`);
    }

    return NextResponse.json({ history: data ?? [] });
  } catch (error) {
    console.error('Error fetching browser scheduler history:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
