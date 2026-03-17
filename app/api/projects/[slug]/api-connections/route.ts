import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createApiConnectionSchema } from '@/lib/validators/workflow';
import { encrypt } from '@/lib/encryption';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/api-connections
export async function GET(_request: Request, context: RouteContext) {
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

    const { data: connections, error } = await supabaseAny
      .from('api_connections')
      .select('id, project_id, name, service_type, status, last_used_at, last_health_check, created_by, created_at, updated_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
    }

    return NextResponse.json({ connections: connections ?? [] });
  } catch (error) {
    console.error('Error in GET /api-connections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/api-connections
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
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = createApiConnectionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, service_type, config } = validationResult.data;

    // Encrypt the config
    const configEncrypted = encrypt(JSON.stringify(config));

    const { data: connection, error } = await supabaseAny
      .from('api_connections')
      .insert({
        project_id: project.id,
        name,
        service_type,
        config_enc: configEncrypted,
        created_by: user.id,
      })
      .select('id, project_id, name, service_type, status, created_by, created_at, updated_at')
      .single();

    if (error) {
      console.error('Error creating api connection:', error);
      return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 });
    }

    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api-connections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
