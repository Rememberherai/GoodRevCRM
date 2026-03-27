import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
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
    if (!project || project.project_type !== 'community') {
      return NextResponse.json({ links: [] });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const [dashboardsResult, calendarResult, resourceHubResult] = await Promise.all([
      supabase
        .from('public_dashboard_configs')
        .select('id, title, slug, status, access_type')
        .eq('project_id', project.id)
        .in('status', ['published', 'preview'])
        .order('title'),
      supabaseAny
        .from('event_calendar_settings')
        .select('slug, is_enabled, title')
        .eq('project_id', project.id)
        .maybeSingle(),
      supabaseAny
        .from('asset_access_settings')
        .select('slug, is_enabled, title')
        .eq('project_id', project.id)
        .maybeSingle(),
    ]);

    interface PublicLink {
      key: string;
      label: string;
      path: string;
      description?: string;
    }

    const links: PublicLink[] = [];

    // Public dashboards
    for (const d of dashboardsResult.data ?? []) {
      if (d.access_type === 'public' || d.access_type === 'password') {
        links.push({
          key: `dashboard-${d.id}`,
          label: d.title || 'Public Dashboard',
          path: `/public/${slug}/${d.slug}`,
          description: 'Public dashboard',
        });
      }
    }

    // Kiosk
    links.push({
      key: 'kiosk',
      label: 'Kiosk',
      path: `/kiosk/${slug}`,
      description: 'PIN-based time clock',
    });

    // Contractor portal
    links.push({
      key: 'contractor',
      label: 'Contractor Portal',
      path: `/contractor/${slug}`,
      description: 'Contractor login page',
    });

    // Events calendar
    if (calendarResult.data?.is_enabled && calendarResult.data?.slug) {
      links.push({
        key: 'events',
        label: calendarResult.data.title || 'Events Calendar',
        path: `/events/${calendarResult.data.slug}`,
        description: 'Public event calendar',
      });
    }

    // Resource hub
    if (resourceHubResult.data?.is_enabled && resourceHubResult.data?.slug) {
      links.push({
        key: 'resources',
        label: resourceHubResult.data.title || 'Resource Hub',
        path: `/resources/${resourceHubResult.data.slug}`,
        description: 'Public resource booking',
      });
    }

    return NextResponse.json({ links });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/public-links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
