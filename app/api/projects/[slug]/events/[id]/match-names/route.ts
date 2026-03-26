import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { matchParsedNames } from '@/lib/events/scan-attendance';
import type { MatchNameEntry } from '@/lib/events/scan-attendance';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'update');

    const { data: event } = await supabase
      .from('events').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const body = await request.json();
    const entries = body.entries as unknown[];

    if (!Array.isArray(entries) || entries.length === 0 || entries.length > 200) {
      return NextResponse.json({ error: 'Provide 1-200 entries' }, { status: 400 });
    }

    // Normalize: accept either strings or {name, email?, phone?} objects
    const normalized: MatchNameEntry[] = [];
    for (const entry of entries) {
      if (typeof entry === 'string' && entry.trim().length > 0) {
        normalized.push({ name: entry.trim() });
      } else if (entry && typeof entry === 'object' && 'name' in entry) {
        const obj = entry as { name?: string; email?: string; phone?: string };
        if (typeof obj.name === 'string' && obj.name.trim().length > 0) {
          normalized.push({
            name: obj.name.trim(),
            email: typeof obj.email === 'string' && obj.email.trim() ? obj.email.trim() : null,
            phone: typeof obj.phone === 'string' && obj.phone.trim() ? obj.phone.trim() : null,
          });
        }
      }
    }

    if (normalized.length === 0) {
      return NextResponse.json({ error: 'No valid entries provided' }, { status: 400 });
    }

    const matched = await matchParsedNames(normalized, project.id);
    return NextResponse.json({ parsed_names: matched });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in POST match-names:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
