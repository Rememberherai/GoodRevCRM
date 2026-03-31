import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export const ANSWER_BANK_CATEGORIES = [
  'mission_statement',
  'org_history',
  'program_description',
  'target_population',
  'budget_narrative',
  'evaluation_plan',
  'sustainability',
  'letters_of_support',
  'other',
] as const;

const createEntrySchema = z.object({
  title: z.string().min(1).max(300),
  category: z.enum(ANSWER_BANK_CATEGORIES).default('other'),
  content: z.string().min(1).max(20000),
  tags: z.array(z.string().max(50)).max(20).default([]),
});

async function getProject(supabase: Awaited<ReturnType<typeof createClient>>, slug: string) {
  const { data: project } = await supabase
    .from('projects')
    .select('id, project_type')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();
  return project;
}

// GET /api/projects/[slug]/grants/answer-bank
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const project = await getProject(supabase, slug);
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'view');

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() ?? '';
    const category = searchParams.get('category') ?? '';

    let query = supabase
      .from('grant_answer_bank')
      .select('id, title, category, content, tags, usage_count, last_used_at, created_at')
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .order('usage_count', { ascending: false })
      .order('created_at', { ascending: false });

    if (category && ANSWER_BANK_CATEGORIES.includes(category as typeof ANSWER_BANK_CATEGORIES[number])) {
      query = query.eq('category', category);
    }

    if (q) {
      const sanitized = q.replace(/[%_\\]/g, '\\$&');
      query = query.or(`title.ilike."%${sanitized}%",content.ilike."%${sanitized}%"`);
    }

    const { data: entries, error } = await query;
    if (error) throw error;

    return NextResponse.json({ entries: entries ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /grants/answer-bank:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/grants/answer-bank
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const project = await getProject(supabase, slug);
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'update');

    const body = await request.json();
    const validation = createEntrySchema.safeParse(body);
    if (!validation.success)
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });

    const { title, category, content, tags } = validation.data;

    const { data: entry, error } = await supabase
      .from('grant_answer_bank')
      .insert({ project_id: project.id, title, category, content, tags, created_by: user.id })
      .select('id, title, category, content, tags, usage_count, last_used_at, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /grants/answer-bank:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
