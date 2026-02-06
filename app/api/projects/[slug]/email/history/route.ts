import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { emailHistoryQuerySchema } from '@/lib/validators/gmail';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/email/history - Get sent emails history
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project ID from slug
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryResult = emailHistoryQuerySchema.safeParse({
      person_id: searchParams.get('person_id') ?? undefined,
      organization_id: searchParams.get('organization_id') ?? undefined,
      opportunity_id: searchParams.get('opportunity_id') ?? undefined,
      rfp_id: searchParams.get('rfp_id') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { person_id, organization_id, opportunity_id, rfp_id, limit, offset } = queryResult.data;

    // Use type assertion since table isn't in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    let query = supabaseAny
      .from('sent_emails')
      .select(`
        id,
        recipient_email,
        subject,
        body_text,
        sent_at,
        tracking_id,
        thread_id,
        message_id,
        person_id,
        organization_id,
        opportunity_id,
        rfp_id,
        created_by
      `)
      .eq('project_id', project.id);

    if (person_id) {
      query = query.eq('person_id', person_id);
    }
    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }
    if (opportunity_id) {
      query = query.eq('opportunity_id', opportunity_id);
    }
    if (rfp_id) {
      query = query.eq('rfp_id', rfp_id);
    }

    const { data: emails, error } = await query
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching email history:', error);
      return NextResponse.json({ error: 'Failed to fetch email history' }, { status: 500 });
    }

    // Get tracking stats for each email
    const emailIds = (emails ?? []).map((e: { id: string }) => e.id);
    let stats: Record<string, unknown>[] = [];

    if (emailIds.length > 0) {
      const { data: trackingStats } = await supabaseAny
        .from('email_tracking_stats')
        .select('sent_email_id, opens, unique_opens, clicks, unique_clicks, replies, bounces')
        .in('sent_email_id', emailIds);

      stats = trackingStats ?? [];
    }

    // Merge stats with emails
    const statsMap = new Map(stats.map((s) => [(s as { sent_email_id: string }).sent_email_id, s]));
    const emailsWithStats = (emails ?? []).map((email: { id: string }) => ({
      ...email,
      stats: statsMap.get(email.id) ?? {
        opens: 0,
        unique_opens: 0,
        clicks: 0,
        unique_clicks: 0,
        replies: 0,
        bounces: 0,
      },
    }));

    return NextResponse.json({
      emails: emailsWithStats,
      pagination: {
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/email/history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
