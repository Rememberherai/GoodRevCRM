import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { z } from 'zod';

const createOutreachSchema = z.object({
  contact_person_id: z.string().uuid('Valid contact person ID required'),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required').max(10000),
});

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || project.project_type !== 'community')
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'view');

    // Verify grant exists
    const { data: grant } = await supabase
      .from('grants')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();
    if (!grant) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

    // Use notes linked to the contact person with grant tag to track outreach
    const { data, error } = await supabase
      .from('notes')
      .select('id, content, content_html, created_at, created_by, person_id')
      .eq('project_id', project.id)
      .not('person_id', 'is', null)
      .ilike('content', `%[grant:${id}]%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ outreach: data ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/grants/[id]/outreach:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || project.project_type !== 'community')
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'update');

    const raw = await request.json();
    const validation = createOutreachSchema.safeParse(raw);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const body = validation.data;

    // Verify grant exists
    const { data: grant } = await supabase
      .from('grants')
      .select('id, name')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();
    if (!grant) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

    // Verify contact person exists in project
    const { data: contact } = await supabase
      .from('people')
      .select('id, email')
      .eq('id', body.contact_person_id)
      .eq('project_id', project.id)
      .single();
    if (!contact) return NextResponse.json({ error: 'Contact person not found' }, { status: 404 });

    // Log the outreach as a note linked to the contact person with grant tag
    const { data: note, error } = await supabase
      .from('notes')
      .insert({
        project_id: project.id,
        person_id: body.contact_person_id,
        content: `[grant:${id}] ${body.subject}\n\n${body.body}`,
        content_html: `<p><strong>[Grant Outreach: ${grant.name}]</strong></p><p><strong>${body.subject}</strong></p>${body.body}`,
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !note) throw error ?? new Error('Failed to create outreach record');

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created',
      entityType: 'grant' as never,
      entityId: id,
      data: { ...note as unknown as Record<string, unknown>, outreach_type: 'grant' },
    });

    return NextResponse.json({ outreach: note }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/projects/[slug]/grants/[id]/outreach:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
