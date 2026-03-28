import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createContractTemplateSchema } from '@/lib/validators/contract';

export async function GET(_request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // RLS returns all accessible templates: project-scoped (via membership) + standalone (via created_by)
  const { data: templates, error } = await supabase
    .from('contract_templates')
    .select('*, projects(name, slug)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }

  return NextResponse.json({ templates: templates ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const result = createContractTemplateSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { data: template, error } = await supabase
    .from('contract_templates')
    .insert({
      ...result.data,
      project_id: null, // Standalone template
      created_by: user.id,
      roles: (result.data.roles ?? []) as unknown as import('@/types/database').Json,
      fields: (result.data.fields ?? []) as unknown as import('@/types/database').Json,
      merge_fields: (result.data.merge_fields ?? []) as unknown as import('@/types/database').Json,
    })
    .select()
    .single();

  if (error) {
    console.error('[TEMPLATES] Create error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }

  return NextResponse.json({ template }, { status: 201 });
}
