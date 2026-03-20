import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/projects/[slug]/people/check-outreach
// Body: { ids: string[] }
// Returns people whose disposition has blocks_outreach = true
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
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

    const body = await request.json();
    const rawIds: unknown = body?.ids;
    if (!Array.isArray(rawIds)) {
      return NextResponse.json({ blocked: [] });
    }

    const ids = rawIds.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id)).slice(0, 2000);
    if (ids.length === 0) {
      return NextResponse.json({ blocked: [] });
    }

    // Query in batches of 300 to stay within Postgres parameter limits
    const blocked: Array<{ person_id: string; person_name: string; disposition_name: string }> = [];
    for (let i = 0; i < ids.length; i += 300) {
      const batch = ids.slice(i, i + 300);
      const { data: people } = await supabase
        .from('people')
        .select('id, first_name, last_name, disposition:dispositions(id, name, blocks_outreach)')
        .eq('project_id', project.id)
        .in('id', batch)
        .is('deleted_at', null);

      for (const p of people ?? []) {
        const disp = p.disposition as { id: string; name: string; blocks_outreach: boolean } | null;
        if (disp?.blocks_outreach === true) {
          blocked.push({
            person_id: p.id,
            person_name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
            disposition_name: disp.name ?? 'Unknown',
          });
        }
      }
    }

    return NextResponse.json({ blocked });
  } catch (error) {
    console.error('Error checking outreach:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
