import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * POST /api/projects/[slug]/email/rematch
 * Re-match emails that have organization_id but no person_id against
 * newly created contacts. Useful after bulk contact creation.
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all unmatched emails (org-only, no person)
    const serviceClient = createServiceClient();
    const { data: unmatchedEmails } = await serviceClient
      .from('emails')
      .select('id, from_email')
      .eq('project_id', project.id)
      .is('person_id', null)
      .not('organization_id', 'is', null)
      .eq('direction', 'inbound');

    if (!unmatchedEmails || unmatchedEmails.length === 0) {
      return NextResponse.json({ matched: 0, still_unmatched: 0 });
    }

    // Get unique from_emails
    const uniqueEmails = [...new Set(unmatchedEmails.map(e => e.from_email?.toLowerCase()).filter(Boolean))];

    // Look up people by email (use ilike via OR filter for case-insensitive match)
    const { data: people } = await serviceClient
      .from('people')
      .select('id, email')
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .or(uniqueEmails.map(e => `email.ilike.${e}`).join(','));

    if (!people || people.length === 0) {
      return NextResponse.json({ matched: 0, still_unmatched: uniqueEmails.length });
    }

    const emailToPersonId = new Map<string, string>();
    for (const person of people) {
      if (person.email) {
        emailToPersonId.set(person.email.toLowerCase(), person.id);
      }
    }

    // Update emails where we now have a matching person
    let matchedCount = 0;
    for (const [email, personId] of emailToPersonId) {
      const { count } = await serviceClient
        .from('emails')
        .update({ person_id: personId }, { count: 'exact' })
        .ilike('from_email', email)
        .eq('project_id', project.id)
        .is('person_id', null)
        .eq('direction', 'inbound');

      matchedCount += count ?? 0;
    }

    const stillUnmatched = uniqueEmails.length - emailToPersonId.size;

    return NextResponse.json({
      matched: matchedCount,
      people_matched: emailToPersonId.size,
      still_unmatched: stillUnmatched,
    });
  } catch (error) {
    console.error('[rematch] Internal error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to rematch emails' },
      { status: 500 }
    );
  }
}
