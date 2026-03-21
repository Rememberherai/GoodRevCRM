import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createBroadcastSchema } from '@/lib/validators/community/broadcasts';
import { resolveBroadcastRecipients } from '@/lib/community/broadcasts';
import type { Database, Json } from '@/types/database';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

type BroadcastInsert = Database['public']['Tables']['broadcasts']['Insert'];

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'broadcasts', 'view');

    const { data, error } = await supabase.from('broadcasts').select('*').eq('project_id', project.id).order('updated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ broadcasts: data ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/broadcasts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'broadcasts', 'create');

    const body = await request.json();
    const validation = createBroadcastSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const recipientPreview = await resolveBroadcastRecipients(project.id, validation.data.filter_criteria as unknown as Json);

    const insertData: BroadcastInsert = {
      ...validation.data,
      project_id: project.id,
      created_by: user.id,
      filter_criteria: validation.data.filter_criteria as unknown as Json,
    };

    const { data, error } = await supabase
      .from('broadcasts')
      .insert(insertData)
      .select()
      .single();

    if (error || !data) throw error ?? new Error('Failed to create broadcast');
    return NextResponse.json({ broadcast: data, recipient_count: recipientPreview.length }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/projects/[slug]/broadcasts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
