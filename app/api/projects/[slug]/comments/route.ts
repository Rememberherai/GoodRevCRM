import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createEntityCommentSchema } from '@/lib/validators/entity-comment';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/comments?entity_type=person&entity_id=<uuid>
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entity_type and entity_id are required' },
        { status: 400 }
      );
    }

    // Get project
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch comments with author info
    const supabaseAny = supabase as any;
    const { data: comments, error } = await supabaseAny
      .from('entity_comments')
      .select(`
        *,
        author:users!created_by(id, full_name, email, avatar_url)
      `)
      .eq('project_id', project.id)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching entity comments:', error);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }

    return NextResponse.json({
      comments: comments ?? [],
      count: comments?.length ?? 0,
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/comments
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Validate body
    const body = await request.json();
    const validationResult = createEntityCommentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { entity_type, entity_id, content, mentions } = validationResult.data;

    // Insert comment
    const supabaseAny = supabase as any;
    const { data: comment, error: insertError } = await supabaseAny
      .from('entity_comments')
      .insert({
        project_id: project.id,
        entity_type,
        entity_id,
        content,
        mentions,
        created_by: user.id,
      })
      .select(`
        *,
        author:users!created_by(id, full_name, email, avatar_url)
      `)
      .single();

    if (insertError) {
      console.error('Error creating entity comment:', insertError);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    // Send mention notifications
    if (mentions.length > 0) {
      // Validate mentioned users are actual project members
      const { data: projectMembers } = await supabaseAny
        .from('project_members')
        .select('user_id')
        .eq('project_id', project.id);

      const validMemberIds = new Set(
        (projectMembers ?? []).map((m: { user_id: string }) => m.user_id)
      );

      const { data: commenter } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const commenterName = commenter?.full_name ?? 'Someone';
      const contentPreview = content.slice(0, 100);
      const entityTypePlural = entity_type === 'person' ? 'people' : `${entity_type}s`;

      for (const mention of mentions) {
        if (mention.user_id === user.id) continue;
        if (!validMemberIds.has(mention.user_id)) continue;

        try {
          await supabaseAny.rpc('create_notification' as never, {
            p_user_id: mention.user_id,
            p_type: 'mention',
            p_title: `${commenterName} mentioned you in a comment`,
            p_message: `${commenterName} mentioned you: "${contentPreview}${content.length > 100 ? '...' : ''}"`,
            p_project_id: project.id,
            p_entity_type: entity_type,
            p_entity_id: entity_id,
            p_action_url: `/projects/${slug}/${entityTypePlural}/${entity_id}?tab=comments`,
          } as never);
        } catch (notifErr) {
          console.error('Failed to create mention notification:', notifErr);
        }
      }
    }

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: entity_type as any,
      entityId: entity_id,
      data: {
        comment_id: comment.id,
        content,
        has_mentions: mentions.length > 0,
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
