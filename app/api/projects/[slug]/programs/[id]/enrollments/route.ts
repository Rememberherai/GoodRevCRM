import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { programEnrollmentSchema } from '@/lib/validators/community/programs';
import { createServiceClient } from '@/lib/supabase/server';
import { createWaiverForEnrollment, createWaiversForEnrollment } from '@/lib/community/waivers';
import type { Database } from '@/types/database';

type ProgramEnrollmentInsert = Database['public']['Tables']['program_enrollments']['Insert'];
interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'programs', 'view');

    const { data: program } = await supabase
      .from('programs')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();
    if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 });

    const { data: enrollments, error } = await supabase
      .from('program_enrollments')
      .select(`
        *,
        person:people(id, first_name, last_name, email),
        household:households(id, name)
      `)
      .eq('program_id', id)
      .order('enrolled_at', { ascending: false });

    if (error) {
      console.error('Error fetching enrollments:', error);
      return NextResponse.json({ error: 'Failed to fetch enrollments' }, { status: 500 });
    }

    return NextResponse.json({ enrollments: enrollments ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/programs/[id]/enrollments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'programs', 'create');

    const { data: program } = await supabase
      .from('programs')
      .select('id, name, requires_waiver')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();
    if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 });

    const body = await request.json();
    const validation = programEnrollmentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const requestedStatus = validation.data.status ?? 'active';
    const requiresWaiver = program.requires_waiver;
    const insertData: ProgramEnrollmentInsert = {
      program_id: id,
      person_id: validation.data.person_id ?? null,
      household_id: validation.data.household_id ?? null,
      status: requiresWaiver && requestedStatus === 'active' ? 'waitlisted' : requestedStatus,
      waiver_status: requiresWaiver ? 'pending' : 'not_required',
      enrolled_at: validation.data.enrolled_at ?? new Date().toISOString(),
      completed_at: validation.data.completed_at ?? null,
      notes: validation.data.notes ?? (requiresWaiver ? 'Awaiting signed waiver' : null),
    };

    const { data: enrollment, error } = await supabase
      .from('program_enrollments')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating enrollment:', error);
      return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 });
    }

    let waiverMessage: string | null = null;
    let waiverDocumentId: string | null = null;
    if (requiresWaiver) {
      const adminClient = createServiceClient();
      const baseParams = {
        supabase,
        adminClient,
        projectId: project.id,
        programId: id,
        programName: program.name ?? 'Program',
        enrollmentId: enrollment.id,
        personId: enrollment.person_id,
        createdBy: user.id,
      };

      // Check for explicit program_waivers (multi-waiver path)
      const { count: programWaiverCount, error: pwCountError } = await supabase
        .from('program_waivers')
        .select('id', { count: 'exact', head: true })
        .eq('program_id', id);

      if (pwCountError) {
        console.error('Error checking program_waivers count:', pwCountError);
      }

      if (programWaiverCount && programWaiverCount > 0) {
        // Multi-waiver: use createWaiversForEnrollment
        const multiResult = await createWaiversForEnrollment(baseParams);
        waiverMessage = multiResult.message;
        waiverDocumentId = multiResult.results[0]?.contractId ?? null;
      } else {
        // Legacy: single blind waiver lookup
        const waiverResult = await createWaiverForEnrollment(baseParams);
        waiverMessage = waiverResult.message;
        waiverDocumentId = waiverResult.contractId;
      }
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'program.enrollment.created' as never,
      entityType: 'program_enrollment',
      entityId: enrollment.id,
      data: enrollment as Record<string, unknown>,
    });

    return NextResponse.json(
      {
        enrollment,
        waiver_required: requiresWaiver,
        waiver_document_id: waiverDocumentId,
        waiver_message: requiresWaiver
          ? waiverMessage ?? 'Enrollment created with pending waiver status. Activate after signature is collected.'
          : null,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/programs/[id]/enrollments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'programs', 'delete');

    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollmentId');
    if (!enrollmentId) {
      return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('program_enrollments')
      .delete()
      .eq('id', enrollmentId)
      .eq('program_id', id)
      .select('id')
      .single();

    if (error) {
      console.error('Error deleting enrollment:', error);
      return NextResponse.json({ error: 'Failed to delete enrollment' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'program_enrollment',
      entityId: enrollmentId,
      data: { id: enrollmentId, program_id: id, project_id: project.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/projects/[slug]/programs/[id]/enrollments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
