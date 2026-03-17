import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateContractTemplateSchema } from '@/lib/validators/contract';

interface RouteContext {
  params: Promise<{ slug: string; tid: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug, tid } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: template } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('id', tid)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();

  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  return NextResponse.json({ template });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { slug, tid } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await request.json();
  const result = updateContractTemplateSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: 'Validation failed', details: result.error.flatten() }, { status: 400 });
  }

  const { data: template, error } = await supabase
    .from('contract_templates')
    .update(result.data)
    .eq('id', tid)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error || !template) return NextResponse.json({ error: 'Failed to update template' }, { status: 409 });

  return NextResponse.json({ template });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { slug, tid } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: deletedTemplate, error } = await supabase
    .from('contract_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', tid)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .select('id')
    .single();

  if (error || !deletedTemplate) {
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
