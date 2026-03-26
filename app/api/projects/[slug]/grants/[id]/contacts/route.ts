import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

const addContactSchema = z.object({
  person_id: z.string().uuid(),
  role: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// GET /api/projects/[slug]/grants/[id]/contacts
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'view');

    // Verify grant belongs to this project
    const { data: grant } = await supabase
      .from('grants')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();
    if (!grant) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

    const { data: contacts, error } = await supabase
      .from('grant_contacts')
      .select(`
        id,
        role,
        notes,
        created_at,
        person:people(id, first_name, last_name, email, title)
      `)
      .eq('grant_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ contacts: contacts ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /grants/[id]/contacts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/grants/[id]/contacts
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    const body = await request.json();
    const validation = addContactSchema.safeParse(body);
    if (!validation.success)
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });

    const { person_id, role, notes } = validation.data;

    // Verify person belongs to this project
    const { data: person } = await supabase
      .from('people')
      .select('id')
      .eq('id', person_id)
      .eq('project_id', project.id)
      .single();
    if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 });

    const { data: contact, error } = await supabase
      .from('grant_contacts')
      .insert({
        grant_id: id,
        person_id,
        role: role ?? null,
        notes: notes ?? null,
      })
      .select(`
        id,
        role,
        notes,
        created_at,
        person:people(id, first_name, last_name, email, title)
      `)
      .single();

    if (error) {
      if (error.code === '23505')
        return NextResponse.json({ error: 'This person is already a contact on this grant' }, { status: 409 });
      throw error;
    }

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /grants/[id]/contacts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
