import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Target, FileText } from 'lucide-react';
import { CompanyContextCard } from '@/components/projects/company-context-card';
import { DashboardActivityCenter } from '@/components/dashboard/activity-center';
import { AnalyticsDashboard } from '@/components/dashboard/analytics-dashboard';
import { NewsHeadlines } from '@/components/dashboard/news-headlines';
import { MetricsCards } from '@/components/community/dashboard/metrics-cards';
import { ImpactRadar } from '@/components/community/dashboard/impact-radar';
import { ProgramCards } from '@/components/community/dashboard/program-cards';
import { ActivityFeed } from '@/components/community/dashboard/activity-feed';
import { MiniMap } from '@/components/community/dashboard/mini-map';
import { PopulationImpact } from '@/components/community/dashboard/population-impact';
import { RiskAlertsPanel } from '@/components/community/dashboard/risk-alerts-panel';
import { getCommunityDashboardData } from '@/lib/community/dashboard';
import type { CompanyContext } from '@/lib/validators/project';
import type { ProjectRole } from '@/types/user';

interface ProjectDashboardProps {
  params: Promise<{ slug: string }>;
}

export default async function ProjectDashboard({ params }: ProjectDashboardProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch project with settings
  const { data: project } = await supabase
    .from('projects')
    .select('id, settings, project_type')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  const projectId = project?.id ?? '';
  const settings = project?.settings as { company_context?: CompanyContext } | null;
  const companyContext = settings?.company_context;

  // Get current user for analytics filter
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? '';

  const { data: membership } = projectId
    ? await supabase
        .from('project_memberships')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', currentUserId)
        .single()
    : { data: null };

  if (project?.project_type === 'community') {
    const dashboardData = await getCommunityDashboardData(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      projectId,
      (membership?.role as ProjectRole | undefined) ?? 'viewer'
    );
    const canSeeDetail = membership?.role !== 'board_viewer' && membership?.role !== 'contractor';

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Community Dashboard</h2>
          <p className="text-muted-foreground">
            Aggregate community metrics and impact framework tracking.
          </p>
        </div>

        <MetricsCards metrics={dashboardData.metrics} />

        <PopulationImpact {...dashboardData.populationImpact} />

        <ImpactRadar dimensions={dashboardData.dimensions} />

        {canSeeDetail && (
          <>
            <MiniMap center={dashboardData.miniMap.center} points={dashboardData.miniMap.points} />
            <RiskAlertsPanel />
            <div className="grid gap-6 xl:grid-cols-2">
              <ProgramCards programs={dashboardData.programs} />
              <ActivityFeed items={dashboardData.recentActivity} />
            </div>
          </>
        )}
      </div>
    );
  }

  // Fetch counts for dashboard widgets
  const [orgsResult, peopleResult, oppsResult, rfpsResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .is('deleted_at', null),
    supabase
      .from('people')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .is('deleted_at', null),
    supabase
      .from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .is('deleted_at', null),
    supabase
      .from('rfps')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .is('deleted_at', null),
  ]);

  const stats = [
    {
      title: 'Organizations',
      value: orgsResult.count ?? 0,
      icon: Building2,
      href: `/projects/${slug}/organizations`,
    },
    {
      title: 'People',
      value: peopleResult.count ?? 0,
      icon: Users,
      href: `/projects/${slug}/people`,
    },
    {
      title: 'Opportunities',
      value: oppsResult.count ?? 0,
      icon: Target,
      href: `/projects/${slug}/opportunities`,
    },
    {
      title: 'RFPs',
      value: rfpsResult.count ?? 0,
      icon: FileText,
      href: `/projects/${slug}/rfps`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of your CRM data
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <CardDescription>
                Total {stat.title.toLowerCase()}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <CompanyContextCard
        projectSlug={slug}
        initialContext={companyContext}
      />

      <NewsHeadlines projectSlug={slug} />

      <DashboardActivityCenter projectSlug={slug} />

      <AnalyticsDashboard projectSlug={slug} currentUserId={currentUserId} />
    </div>
  );
}
