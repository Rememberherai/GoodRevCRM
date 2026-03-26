import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { rowsToCsv } from '@/lib/reports/csv-export';

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
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'export_pii');

    const { data: event } = await supabase
      .from('events').select('title').eq('id', id).eq('project_id', project.id).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { data: registrations, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: true })
      .limit(50000);

    if (error) {
      console.error('Error fetching registrations for export:', error);
      return NextResponse.json({ error: 'Failed to export' }, { status: 500 });
    }

    const columns = [
      'registrant_name',
      'registrant_email',
      'registrant_phone',
      'status',
      'checked_in_at',
      'waiver_status',
      'source',
      'created_at',
    ];

    const headerLabels: Record<string, string> = {
      registrant_name: 'Name',
      registrant_email: 'Email',
      registrant_phone: 'Phone',
      status: 'Status',
      checked_in_at: 'Checked In At',
      waiver_status: 'Waiver Status',
      source: 'Source',
      created_at: 'Registered At',
    };

    const csv = rowsToCsv(columns, registrations ?? [], headerLabels);
    const filename = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_registrations.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in GET export:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
