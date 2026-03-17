import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Verify document exists
  const { data: document } = await supabase
    .from('contract_documents')
    .select('id')
    .eq('id', id)
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .single();

  if (!document) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const { data: auditTrail, error } = await supabase
    .from('contract_audit_trail')
    .select('*')
    .eq('document_id', id)
    .eq('project_id', project.id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch audit trail' }, { status: 500 });
  }

  return NextResponse.json({ audit_trail: auditTrail ?? [] });
}
