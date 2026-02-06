import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createRfpSchema } from '@/lib/validators/rfp';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type RfpInsert = Database['public']['Tables']['rfps']['Insert'];
type Rfp = Database['public']['Tables']['rfps']['Row'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/rfps - List RFPs
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
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const search = searchParams.get('search') ?? '';
    const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'title', 'status', 'due_date', 'estimated_value', 'rfp_number'];
    const rawSortBy = searchParams.get('sortBy') ?? 'created_at';
    const sortBy = ALLOWED_SORT_COLUMNS.includes(rawSortBy) ? rawSortBy : 'created_at';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';
    const status = searchParams.get('status');
    const rawOrganizationId = searchParams.get('organizationId');
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const organizationId = rawOrganizationId && UUID_REGEX.test(rawOrganizationId) ? rawOrganizationId : null;
    const upcoming = searchParams.get('upcoming');

    // Custom field filters
    const source = searchParams.get('source'); // e.g., 'municipal_minutes'
    const region = searchParams.get('region'); // e.g., 'Nova Scotia'
    const committeeName = searchParams.get('committee'); // e.g., 'Regional Council'
    const minConfidence = searchParams.get('minConfidence'); // e.g., '70'

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('rfps')
      .select('*', { count: 'exact' })
      .eq('project_id', project.id)
      .is('deleted_at', null);

    // Apply search filter (escape special PostgREST characters)
    if (search) {
      const escaped = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
      query = query.or(`title.ilike."%${escaped}%",rfp_number.ilike."%${escaped}%",description.ilike."%${escaped}%"`);
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status as Database['public']['Enums']['rfp_status']);
    }

    // Apply organization filter
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    // Filter for upcoming deadlines (next 30 days)
    if (upcoming === 'true') {
      const now = new Date().toISOString();
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query
        .gte('due_date', now)
        .lte('due_date', thirtyDaysFromNow)
        .not('status', 'in', '("won","lost","no_bid")');
    }

    // Apply custom field filters using JSONB operators
    if (source) {
      query = query.eq('custom_fields->source', source);
    }

    if (region) {
      query = query.eq('custom_fields->region', region);
    }

    if (committeeName) {
      query = query.eq('custom_fields->committee_name', committeeName);
    }

    if (minConfidence) {
      const confidence = parseInt(minConfidence, 10);
      if (!isNaN(confidence) && confidence >= 0 && confidence <= 100) {
        query = query.gte('custom_fields->ai_confidence', confidence);
      }
    }

    // Apply sorting
    const ascending = sortOrder === 'asc';
    query = query.order(sortBy, { ascending });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: rfps, error, count } = await query;

    if (error) {
      console.error('Error fetching RFPs:', error);
      return NextResponse.json({ error: 'Failed to fetch RFPs' }, { status: 500 });
    }

    // Fetch question counts for each RFP
    const rfpList = (rfps ?? []) as Rfp[];
    const rfpIds = rfpList.map((r) => r.id);
    const questionCountsMap: Record<string, { total: number; answered: number }> = {};

    if (rfpIds.length > 0) {
      const { data: questionRows } = await supabase
        .from('rfp_questions')
        .select('rfp_id, status')
        .in('rfp_id', rfpIds)
        .is('deleted_at', null);

      type QuestionRow = Database['public']['Tables']['rfp_questions']['Row'];
      if (questionRows) {
        for (const q of questionRows as QuestionRow[]) {
          if (!questionCountsMap[q.rfp_id]) {
            questionCountsMap[q.rfp_id] = { total: 0, answered: 0 };
          }
          questionCountsMap[q.rfp_id]!.total++;
          if (q.status !== 'unanswered') {
            questionCountsMap[q.rfp_id]!.answered++;
          }
        }
      }
    }

    const rfpsWithCounts = rfpList.map((r) => ({
      ...r,
      question_counts: questionCountsMap[r.id] ?? { total: 0, answered: 0 },
    }));

    return NextResponse.json({
      rfps: rfpsWithCounts,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/rfps:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/rfps - Create RFP
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

    const body = await request.json();
    const validationResult = createRfpSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const rfpData: RfpInsert = {
      ...validationResult.data,
      project_id: project.id,
      created_by: user.id,
      custom_fields: validationResult.data.custom_fields as RfpInsert['custom_fields'],
    };

    const { data: rfp, error } = await supabase
      .from('rfps')
      .insert(rfpData)
      .select()
      .single();

    if (error) {
      console.error('Error creating RFP:', error);
      return NextResponse.json({ error: 'Failed to create RFP' }, { status: 500 });
    }

    // Emit automation event
    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created',
      entityType: 'rfp',
      entityId: (rfp as Rfp).id,
      data: rfp as Record<string, unknown>,
    });

    return NextResponse.json({ rfp: rfp as Rfp }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/rfps:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
