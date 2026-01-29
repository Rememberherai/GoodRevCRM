import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Target, FileText } from 'lucide-react';

interface ProjectDashboardProps {
  params: Promise<{ slug: string }>;
}

export default async function ProjectDashboard({ params }: ProjectDashboardProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch counts for dashboard widgets
  const [orgsResult, peopleResult, oppsResult, rfpsResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', (await supabase.from('projects').select('id').eq('slug', slug).single()).data?.id ?? '')
      .is('deleted_at', null),
    supabase
      .from('people')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', (await supabase.from('projects').select('id').eq('slug', slug).single()).data?.id ?? '')
      .is('deleted_at', null),
    supabase
      .from('opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', (await supabase.from('projects').select('id').eq('slug', slug).single()).data?.id ?? '')
      .is('deleted_at', null),
    supabase
      .from('rfps')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', (await supabase.from('projects').select('id').eq('slug', slug).single()).data?.id ?? '')
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates in your CRM</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              No recent activity yet. Start by adding organizations, people, or opportunities.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Use the sidebar to navigate to different sections and start adding data.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
