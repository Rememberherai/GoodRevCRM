import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createContractTemplateSchema } from '@/lib/validators/contract';
import type { Database } from '@/types/database';

type TemplateInsert = Database['public']['Tables']['contract_templates']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
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

  const { data: templates, error } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });

  return NextResponse.json({ templates: templates ?? [] });
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
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
  const result = createContractTemplateSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: 'Validation failed', details: result.error.flatten() }, { status: 400 });
  }

  const templateData: TemplateInsert = {
    ...result.data,
    project_id: project.id,
    created_by: user.id,
    roles: (result.data.roles ?? []) as TemplateInsert['roles'],
    fields: (result.data.fields ?? []) as TemplateInsert['fields'],
    merge_fields: (result.data.merge_fields ?? []) as TemplateInsert['merge_fields'],
  };

  const { data: template, error } = await supabase
    .from('contract_templates')
    .insert(templateData)
    .select()
    .single();

  if (error) {
    console.error('[CONTRACT_TEMPLATES] Create error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }

  return NextResponse.json({ template }, { status: 201 });
}
