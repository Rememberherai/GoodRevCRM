import { createClient } from '@/lib/supabase/server';
import { ReportsTabNav } from './reports-tab-nav';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function ReportsLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects')
    .select('project_type')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  const isCommunity = project?.project_type === 'community';

  if (!isCommunity) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reporting</h2>
        <p className="text-sm text-muted-foreground">
          Community analytics, impact reports, and public dashboard configuration.
        </p>
      </div>

      <ReportsTabNav />

      {children}
    </div>
  );
}
