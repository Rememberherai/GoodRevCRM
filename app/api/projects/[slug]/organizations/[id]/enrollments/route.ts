import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

/**
 * GET /api/projects/[slug]/organizations/[id]/enrollments
 * Get all sequence enrollments for people belonging to this organization.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id: organizationId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Get all people linked to this organization
    const { data: personOrgs } = await supabaseAny
      .from('person_organizations')
      .select('person_id')
      .eq('organization_id', organizationId);

    const personIds = (personOrgs ?? []).map((po: { person_id: string }) => po.person_id);

    if (personIds.length === 0) {
      return NextResponse.json({ enrollments: [] });
    }

    // Get all enrollments for these people
    const { data: enrollments, error } = await supabaseAny
      .from('sequence_enrollments')
      .select(`
        *,
        sequence:sequences(id, name, status, description),
        person:people(id, first_name, last_name, email)
      `)
      .in('person_id', personIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching org enrollments:', error);
      return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 });
    }

    return NextResponse.json({ enrollments: enrollments ?? [] });
  } catch (error) {
    console.error('Error in GET org enrollments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
