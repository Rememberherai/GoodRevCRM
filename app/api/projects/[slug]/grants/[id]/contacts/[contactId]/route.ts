import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';

interface RouteContext {
  params: Promise<{ slug: string; id: string; contactId: string }>;
}

// DELETE /api/projects/[slug]/grants/[id]/contacts/[contactId]
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id, contactId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'update');

    // Verify grant belongs to this project
    const { data: grant } = await supabase
      .from('grants')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();
    if (!grant) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

    const { error } = await supabase
      .from('grant_contacts')
      .delete()
      .eq('id', contactId)
      .eq('grant_id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in DELETE /grants/[id]/contacts/[contactId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
