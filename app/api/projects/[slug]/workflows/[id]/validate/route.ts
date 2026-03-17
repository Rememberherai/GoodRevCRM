import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { validateWorkflowSchema } from '@/lib/validators/workflow';
import { validateWorkflow } from '@/lib/workflows/validators/validate-workflow';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/workflows/[id]/validate
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;
    const { data: membership } = await supabaseAny
      .from('project_memberships').select('role')
      .eq('project_id', project.id).eq('user_id', user.id).single();
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    const parsed = validateWorkflowSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid definition format', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const errors = validateWorkflow(parsed.data.definition);
    const isValid = !errors.some((e) => e.severity === 'error');

    return NextResponse.json({
      valid: isValid,
      errors: errors.filter((e) => e.severity === 'error'),
      warnings: errors.filter((e) => e.severity === 'warning'),
    });
  } catch (error) {
    console.error('Error in POST /workflows/[id]/validate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
