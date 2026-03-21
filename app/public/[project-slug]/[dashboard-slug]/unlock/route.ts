import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPublicDashboardPassword } from '@/lib/community/public-dashboard-auth';

interface RouteContext {
  params: Promise<{ 'project-slug': string; 'dashboard-slug': string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const routeParams = await context.params;
  const projectSlug = routeParams['project-slug'];
  const dashboardSlug = routeParams['dashboard-slug'];
  const admin = createAdminClient();
  const formData = await request.formData();
  const password = String(formData.get('password') ?? '');

  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('slug', projectSlug)
    .is('deleted_at', null)
    .maybeSingle();

  if (!project) {
    return NextResponse.redirect(new URL(`/public/${projectSlug}/${dashboardSlug}`, request.url));
  }

  const { data: config } = await admin
    .from('public_dashboard_configs')
    .select('*')
    .eq('project_id', project.id)
    .eq('slug', dashboardSlug)
    .in('status', ['published', 'preview'])
    .maybeSingle();

  if (!config?.password_hash || !verifyPublicDashboardPassword(password, config.password_hash)) {
    return NextResponse.redirect(new URL(`/public/${projectSlug}/${dashboardSlug}?password_error=1`, request.url));
  }

  const response = NextResponse.redirect(new URL(`/public/${projectSlug}/${dashboardSlug}`, request.url));
  response.cookies.set(`public-dashboard-${config.id}`, '1', {
    httpOnly: true,
    path: `/public/${projectSlug}/${dashboardSlug}`,
    sameSite: 'lax',
  });
  return response;
}
