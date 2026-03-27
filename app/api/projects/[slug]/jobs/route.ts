import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createJobSchema } from '@/lib/validators/community/contractors';
import { checkContractorScopeMatch } from '@/lib/community/jobs';
import { createProjectNotification } from '@/lib/community/notifications';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { syncJobAssignment } from '@/lib/assistant/calendar-bridge';
import type { Database } from '@/types/database';

type JobInsert = Database['public']['Tables']['jobs']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') return NextResponse.json({ error: 'Not a community project' }, { status: 400 });

    await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'view');

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const contractorId = searchParams.get('contractorId');
    const includeUnassigned = searchParams.get('includeUnassigned') === 'true';

    let query = supabase
      .from('jobs')
      .select('*, contractor:people!jobs_contractor_id_fkey(id, first_name, last_name, user_id), time_entries:job_time_entries(id, started_at, ended_at, is_break, duration_minutes, notes)')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (contractorId && includeUnassigned) {
      query = query.or(`contractor_id.eq.${contractorId},contractor_id.is.null`);
    } else if (contractorId) {
      query = query.eq('contractor_id', contractorId);
    } else if (includeUnassigned) {
      query = query.is('contractor_id', null);
    }

    const { data: jobs, error } = await query;
    if (error) {
      console.error('Error fetching jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }

    return NextResponse.json({ jobs: jobs ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/jobs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') return NextResponse.json({ error: 'Not a community project' }, { status: 400 });

    await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'create');

    const body = await request.json() as Record<string, unknown>;
    const validation = createJobSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const allowOutOfScope = body.allow_out_of_scope === true;
    let scopeId: string | null = null;
    let isOutOfScope = validation.data.is_out_of_scope;
    let scopeWarning: string | null = null;

    if (validation.data.contractor_id) {
      const scopeMatch = await checkContractorScopeMatch(supabase, project.id, validation.data.contractor_id, {
        serviceCategory: validation.data.service_category,
        requiredCertifications: validation.data.required_certifications,
        serviceLatitude: validation.data.service_latitude,
        serviceLongitude: validation.data.service_longitude,
      });

      scopeId = scopeMatch.scopeId;
      if (!scopeMatch.matches) {
        if (!allowOutOfScope) {
          return NextResponse.json(
            {
              error: scopeMatch.reason ?? 'This job falls outside the contractor scope of work.',
              requires_override: true,
              scope_id: scopeMatch.scopeId,
            },
            { status: 409 }
          );
        }

        isOutOfScope = true;
        scopeWarning = scopeMatch.reason;
      }
    }

    const insertData: JobInsert = {
      project_id: project.id,
      contractor_id: validation.data.contractor_id ?? null,
      assigned_by: user.id,
      scope_id: scopeId,
      title: validation.data.title,
      description: validation.data.description ?? null,
      status: validation.data.status,
      priority: validation.data.priority,
      desired_start: validation.data.desired_start ?? null,
      deadline: validation.data.deadline ?? null,
      service_address: validation.data.service_address ?? null,
      service_category: validation.data.service_category ?? null,
      service_type_id: validation.data.service_type_id ?? null,
      required_certifications: validation.data.required_certifications,
      service_latitude: validation.data.service_latitude ?? null,
      service_longitude: validation.data.service_longitude ?? null,
      is_out_of_scope: isOutOfScope,
      notes: validation.data.notes ?? null,
    };

    // Use admin client for insert — permissions already validated via requireCommunityPermission above
    const adminClient = createAdminClient();
    const { data: job, error } = await adminClient
      .from('jobs')
      .insert(insertData)
      .select('*, contractor:people!jobs_contractor_id_fkey(id, first_name, last_name, user_id)')
      .single();

    if (error || !job) {
      console.error('Error creating job:', error);
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
    }

    if (job.contractor?.user_id) {
      await createProjectNotification({
        supabase,
        userId: job.contractor.user_id,
        projectId: project.id,
        title: 'New job assigned',
        message: `You have a new job: ${job.title}`,
        entityType: 'job',
        entityId: job.id,
        actionUrl: `/contractor/${slug}`,
        priority: 'high',
      });
    }

    let calendarSync: { synced: boolean; reason?: string; eventId?: string } | null = null;
    try {
      calendarSync = await syncJobAssignment(job.id);
    } catch (calendarError) {
      calendarSync = {
        synced: false,
        reason: calendarError instanceof Error ? calendarError.message : 'Calendar sync failed',
      };
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'job.assigned' as never,
      entityType: 'job' as never,
      entityId: job.id,
      data: job as Record<string, unknown>,
    });

    return NextResponse.json({ job, scope_warning: scopeWarning, calendar_sync: calendarSync }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/jobs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
