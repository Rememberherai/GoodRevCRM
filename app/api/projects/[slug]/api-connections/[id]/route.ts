import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateApiConnectionSchema } from '@/lib/validators/workflow';
import { encrypt } from '@/lib/encryption';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// PATCH /api/projects/[slug]/api-connections/[id]
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = updateApiConnectionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (validationResult.data.name) updates.name = validationResult.data.name;
    if (validationResult.data.status) updates.status = validationResult.data.status;
    if (validationResult.data.config) {
      updates.config_enc = encrypt(JSON.stringify(validationResult.data.config));
    }

    const { data: connection, error } = await supabaseAny
      .from('api_connections')
      .update(updates)
      .eq('id', id)
      .eq('project_id', project.id)
      .select('id, project_id, name, service_type, status, last_used_at, last_health_check, created_by, created_at, updated_at')
      .single();

    if (error || !connection) {
      return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 });
    }

    return NextResponse.json({ connection });
  } catch (error) {
    console.error('Error in PATCH /api-connections/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/api-connections/[id]
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const { error } = await supabaseAny
      .from('api_connections').delete()
      .eq('id', id).eq('project_id', project.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api-connections/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
