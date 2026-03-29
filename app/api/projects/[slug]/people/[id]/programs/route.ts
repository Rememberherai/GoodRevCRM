import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id: personId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project || project.project_type !== 'community') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await requireCommunityPermission(supabase, user.id, project.id, 'programs', 'view');

    const { data: person } = await supabase
      .from('people')
      .select('id')
      .eq('id', personId)
      .eq('project_id', project.id)
      .maybeSingle();

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Get program IDs scoped to this project first, then filter enrollments
    const { data: projectPrograms } = await supabase
      .from('programs')
      .select('id')
      .eq('project_id', project.id);

    const projectProgramIds = (projectPrograms ?? []).map((p) => p.id);

    if (projectProgramIds.length === 0) {
      return NextResponse.json({ enrollments: [] });
    }

    const { data: enrollments, error } = await supabase
      .from('program_enrollments')
      .select(`
        id,
        status,
        enrolled_at,
        completed_at,
        notes,
        waiver_status,
        program:programs!inner(
          id,
          name,
          description
        )
      `)
      .eq('person_id', personId)
      .in('program_id', projectProgramIds)
      .order('enrolled_at', { ascending: false });

    if (error) throw error;

    // For each enrollment, aggregate attendance (session count + total hours)
    const programIds = [...new Set((enrollments ?? []).map((e) => (e.program as { id: string }).id))];
    let attendanceMap: Record<string, { session_count: number; total_hours: number }> = {};

    if (programIds.length > 0) {
      const { data: attendanceRows } = await supabase
        .from('program_attendance')
        .select('program_id, hours, status')
        .eq('person_id', personId)
        .in('program_id', programIds)
        .eq('status', 'present');

      if (attendanceRows) {
        for (const row of attendanceRows) {
          if (!attendanceMap[row.program_id]) {
            attendanceMap[row.program_id] = { session_count: 0, total_hours: 0 };
          }
          const entry = attendanceMap[row.program_id]!;
          entry.session_count += 1;
          entry.total_hours += row.hours ?? 0;
        }
      }
    }

    const result = (enrollments ?? []).map((enrollment) => {
      const prog = enrollment.program as { id: string; name: string; description: string | null };
      const attendance = attendanceMap[prog.id] ?? { session_count: 0, total_hours: 0 };
      return {
        ...enrollment,
        session_count: attendance.session_count,
        total_hours: attendance.total_hours,
      };
    });

    return NextResponse.json({ enrollments: result });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/people/[id]/programs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
