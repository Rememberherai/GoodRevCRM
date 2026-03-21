import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getPublicDashboardAggregateData } from '@/lib/community/public-dashboard-queries';
import { PublicDashboardPasswordGate } from '@/components/community/public-dashboard/public-dashboard-password-gate';
import { PublicDashboardView } from '@/components/community/public-dashboard/public-dashboard-view';
import type { PublicDashboardAggregateData } from '@/lib/community/public-dashboard-queries';

interface PublicDashboardPageProps {
  params: Promise<{ 'project-slug': string; 'dashboard-slug': string }>;
  searchParams: Promise<{ password_error?: string }>;
}

export default async function PublicDashboardPage({ params, searchParams }: PublicDashboardPageProps) {
  const routeParams = await params;
  const resolvedSearchParams = await searchParams;
  const projectSlug = routeParams['project-slug'];
  const dashboardSlug = routeParams['dashboard-slug'];
  const admin = createAdminClient();

  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('slug', projectSlug)
    .is('deleted_at', null)
    .maybeSingle();

  if (!project) notFound();

  const { data: config } = await admin
    .from('public_dashboard_configs')
    .select('*')
    .eq('project_id', project.id)
    .eq('slug', dashboardSlug)
    .in('status', ['published', 'preview'])
    .maybeSingle();

  if (!config) notFound();

  if (config.status === 'preview') {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) notFound();
    const { data: membership } = await supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      notFound();
    }
  }

  if (config.status === 'published' && config.access_type === 'signed_link') {
    notFound();
  }

  const cookieStore = await cookies();
  const passwordCookie = cookieStore.get(`public-dashboard-${config.id}`)?.value;
  if (config.access_type === 'password' && passwordCookie !== '1') {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16">
        <PublicDashboardPasswordGate
          title={config.title}
          action={`/public/${projectSlug}/${dashboardSlug}/unlock`}
          error={resolvedSearchParams.password_error ? 'Incorrect password' : null}
        />
      </div>
    );
  }

  const data = (config.data_freshness === 'snapshot' && config.snapshot_data
    ? config.snapshot_data
    : await getPublicDashboardAggregateData(config)) as PublicDashboardAggregateData;

  return <PublicDashboardView config={config} data={data} />;
}
