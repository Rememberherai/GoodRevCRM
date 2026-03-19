import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/projects/[slug]/email/unknown-senders
 * Returns inbound emails from unknown senders at known organizations
 * (emails with organization_id set but person_id null).
 *
 * Query params:
 *   organization_id - optional filter to scope to one org
 *   limit           - max results (default 50)
 *   offset          - pagination offset (default 0)
 */
export async function GET(request: Request, context: RouteContext) {
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

    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organization_id');
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '50');
    const rawOffset = parseInt(url.searchParams.get('offset') ?? '0');
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 200);
    const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);

    // Query unknown sender emails grouped by from_email + organization
    // Using raw SQL via RPC would be ideal for GROUP BY, but we can do this
    // with a two-step approach: get emails, then aggregate client-side
    let query = supabase
      .from('emails')
      .select('from_email, from_name, organization_id, email_date, gmail_message_id')
      .eq('project_id', project.id)
      .is('person_id', null)
      .not('organization_id', 'is', null)
      .eq('direction', 'inbound')
      .order('email_date', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: emails, error } = await query;

    if (error) {
      console.error('[unknown-senders] Failed to fetch emails:', error.message);
      return NextResponse.json({ error: 'Failed to fetch unknown senders' }, { status: 500 });
    }

    // Aggregate by from_email + organization_id
    const senderMap = new Map<string, {
      from_email: string;
      from_name: string;
      organization_id: string;
      email_count: number;
      latest_email_date: string;
      earliest_email_date: string;
    }>();

    for (const email of emails ?? []) {
      const key = `${email.from_email?.toLowerCase()}|${email.organization_id}`;
      const existing = senderMap.get(key);
      if (existing) {
        existing.email_count++;
        if (email.email_date > existing.latest_email_date) {
          existing.latest_email_date = email.email_date;
          // Use the most recent from_name (may be more complete)
          if (email.from_name) existing.from_name = email.from_name;
        }
        if (email.email_date < existing.earliest_email_date) {
          existing.earliest_email_date = email.email_date;
        }
      } else {
        senderMap.set(key, {
          from_email: email.from_email?.toLowerCase() ?? '',
          from_name: email.from_name ?? '',
          organization_id: email.organization_id!,
          email_count: 1,
          latest_email_date: email.email_date,
          earliest_email_date: email.email_date,
        });
      }
    }

    // Sort by latest email date descending
    const senders = [...senderMap.values()]
      .sort((a, b) => b.latest_email_date.localeCompare(a.latest_email_date));

    const total = senders.length;
    const paginated = senders.slice(offset, offset + limit);

    // Enrich with organization names
    const orgIds = [...new Set(paginated.map(s => s.organization_id))];
    const orgMap = new Map<string, { name: string; domain: string | null }>();

    if (orgIds.length > 0) {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, domain')
        .in('id', orgIds);

      for (const org of orgs ?? []) {
        orgMap.set(org.id, { name: org.name, domain: org.domain });
      }
    }

    const enriched = paginated.map(s => ({
      ...s,
      organization_name: orgMap.get(s.organization_id)?.name ?? 'Unknown',
      organization_domain: orgMap.get(s.organization_id)?.domain ?? null,
    }));

    return NextResponse.json({ senders: enriched, total });
  } catch (error) {
    console.error('[unknown-senders] Internal error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to fetch unknown senders' },
      { status: 500 }
    );
  }
}
