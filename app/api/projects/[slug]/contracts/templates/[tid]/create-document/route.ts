import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { insertAuditTrail } from '@/lib/contracts/audit';
import type { Database } from '@/types/database';

type DocInsert = Database['public']['Tables']['contract_documents']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string; tid: string }>;
}

export async function POST(request: Request, context: RouteContext) {
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

  const body = await request.json();
  const { title, opportunity_id, organization_id, person_id } = body;

  const docData: DocInsert = {
    project_id: project.id,
    title: title ?? template.name,
    original_file_path: template.file_path,
    original_file_name: template.file_name,
    page_count: template.page_count,
    template_id: tid,
    opportunity_id: opportunity_id ?? null,
    organization_id: organization_id ?? null,
    person_id: person_id ?? null,
    created_by: user.id,
    owner_id: user.id,
  };

  const { data: document, error } = await supabase
    .from('contract_documents')
    .insert(docData)
    .select()
    .single();

  if (error) {
    console.error('[CONTRACT_FROM_TEMPLATE] Create error:', error);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }

  // Update template use count
  await supabase
    .from('contract_templates')
    .update({
      use_count: (template.use_count ?? 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', tid)
    .eq('project_id', project.id);

  insertAuditTrail({
    project_id: project.id,
    document_id: document.id,
    action: 'created',
    actor_type: 'user',
    actor_id: user.id,
    details: { from_template: tid, template_name: template.name },
  });

  return NextResponse.json({ contract: document }, { status: 201 });
}
