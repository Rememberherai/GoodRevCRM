import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateContractTemplateSchema } from '@/lib/validators/contract';

interface RouteContext {
  params: Promise<{ tid: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { tid } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // RLS handles access
  const { data: template } = await supabase
    .from('contract_templates')
    .select('*, projects(name, slug)')
    .eq('id', tid)
    .is('deleted_at', null)
    .single();

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ template });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { tid } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const result = updateContractTemplateSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = { ...result.data };
  if (result.data.roles) updateData.roles = result.data.roles;
  if (result.data.fields) updateData.fields = result.data.fields;
  if (result.data.merge_fields) updateData.merge_fields = result.data.merge_fields;

  const { data: template, error } = await supabase
    .from('contract_templates')
    .update(updateData)
    .eq('id', tid)
    .is('deleted_at', null)
    .select()
    .single();

  if (error || !template) {
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }

  return NextResponse.json({ template });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { tid } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('contract_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', tid)
    .is('deleted_at', null)
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
