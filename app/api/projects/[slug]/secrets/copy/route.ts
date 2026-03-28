import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { copyProjectSecrets } from '@/lib/secrets';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const copySchema = z.object({
  source_project_id: z.string().uuid(),
});

// POST /api/projects/[slug]/secrets/copy — copy keys from another project
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

    // Resolve target project
    const { data: targetProject } = await supabase
      .from('projects')
      .select('id, owner_id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!targetProject) {
      return NextResponse.json({ error: 'Target project not found' }, { status: 404 });
    }

    // Check admin/owner on target
    const { data: targetMembership } = await supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', targetProject.id)
      .eq('user_id', user.id)
      .single();

    const isTargetOwner = targetProject.owner_id === user.id;
    const targetRole = (targetMembership as { role?: string } | null)?.role;
    if (!isTargetOwner && targetRole !== 'admin') {
      return NextResponse.json({ error: 'Permission denied on target project' }, { status: 403 });
    }

    // Parse body
    const body = await request.json();
    const validation = copySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { source_project_id } = validation.data;

    if (source_project_id === targetProject.id) {
      return NextResponse.json({ error: 'Source and target project are the same' }, { status: 400 });
    }

    // Check admin/owner on source project
    const { data: sourceProject } = await supabase
      .from('projects')
      .select('id, owner_id')
      .eq('id', source_project_id)
      .is('deleted_at', null)
      .single();

    if (!sourceProject) {
      return NextResponse.json({ error: 'Source project not found' }, { status: 404 });
    }

    const { data: sourceMembership } = await supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', sourceProject.id)
      .eq('user_id', user.id)
      .single();

    const isSourceOwner = sourceProject.owner_id === user.id;
    const sourceRole = (sourceMembership as { role?: string } | null)?.role;
    if (!isSourceOwner && sourceRole !== 'admin') {
      return NextResponse.json({ error: 'Permission denied on source project' }, { status: 403 });
    }

    // Copy the secrets
    const copied = await copyProjectSecrets(source_project_id, targetProject.id, user.id);

    return NextResponse.json({
      copied: copied.length,
      keys: copied,
    });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/secrets/copy:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
