import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { updateJobSchema } from '@/lib/validators/community/contractors';
import { checkContractorScopeMatch } from '@/lib/community/jobs';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type JobUpdate = Database['public']['Tables']['jobs']['Update'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

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
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') return NextResponse.json({ error: 'Not a community project' }, { status: 400 });

    await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'view');

    const { data: job, error } = await supabase
      .from('jobs')
      .select('*, contractor:people!jobs_contractor_id_fkey(*), time_entries:job_time_entries(*), scope:contractor_scopes(*)')
      .eq('project_id', project.id)
      .eq('id', id)
      .single();

    if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/jobs/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') return NextResponse.json({ error: 'Not a community project' }, { status: 400 });

    const role = await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'update');

    const body = await request.json() as Record<string, unknown>;
    const validation = updateJobSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    if (role === 'contractor') {
      const allowedContractorKeys = new Set(['status', 'notes']);
      const disallowedKeys = Object.keys(validation.data).filter((key) => !allowedContractorKeys.has(key));
      if (disallowedKeys.length > 0) {
        return NextResponse.json(
          { error: 'Contractors can only update job status and notes from this route' },
          { status: 403 }
        );
      }
    }

    let scopeId: string | null | undefined;
    let isOutOfScope = validation.data.is_out_of_scope;

    if (validation.data.contractor_id) {
      const scopeMatch = await checkContractorScopeMatch(supabase, project.id, validation.data.contractor_id, {
        serviceCategory: validation.data.service_category,
        requiredCertifications: validation.data.required_certifications,
        serviceLatitude: validation.data.service_latitude,
        serviceLongitude: validation.data.service_longitude,
      });
      scopeId = scopeMatch.scopeId;
      if (!scopeMatch.matches && body.allow_out_of_scope !== true) {
        return NextResponse.json(
          { error: scopeMatch.reason ?? 'This job falls outside the contractor scope of work.', requires_override: true },
          { status: 409 }
        );
      }
      if (!scopeMatch.matches) {
        isOutOfScope = true;
      }
    }

    const d = validation.data;
    const updateData: JobUpdate = {};

    if (role === 'contractor') {
      if (d.status !== undefined) updateData.status = d.status;
      if (d.notes !== undefined) updateData.notes = d.notes;
    } else {
      if (d.contractor_id !== undefined) updateData.contractor_id = d.contractor_id;
      if (scopeId !== undefined) updateData.scope_id = scopeId;
      if (d.title !== undefined) updateData.title = d.title;
      if (d.description !== undefined) updateData.description = d.description;
      if (d.status !== undefined) updateData.status = d.status;
      if (d.priority !== undefined) updateData.priority = d.priority;
      if (d.desired_start !== undefined) updateData.desired_start = d.desired_start ?? null;
      if (d.deadline !== undefined) updateData.deadline = d.deadline ?? null;
      if (d.service_address !== undefined) updateData.service_address = d.service_address;
      if (d.service_category !== undefined) updateData.service_category = d.service_category;
      if (d.required_certifications !== undefined) updateData.required_certifications = d.required_certifications;
      if (d.service_latitude !== undefined) updateData.service_latitude = d.service_latitude ?? null;
      if (d.service_longitude !== undefined) updateData.service_longitude = d.service_longitude ?? null;
      if (isOutOfScope !== undefined) updateData.is_out_of_scope = isOutOfScope;
      if (d.notes !== undefined) updateData.notes = d.notes;
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('project_id', project.id)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !job) {
      console.error('Error updating job:', error);
      return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'job' as never,
      entityId: job.id,
      data: job as Record<string, unknown>,
    });

    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/jobs/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') return NextResponse.json({ error: 'Not a community project' }, { status: 400 });

    await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'delete');

    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('project_id', project.id)
      .eq('id', id);

    if (error) {
      console.error('Error deleting job:', error);
      return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'job' as never,
      entityId: id,
      data: {},
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/projects/[slug]/jobs/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
