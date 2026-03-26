import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { ProjectSidebar } from '@/components/layout/project-sidebar';
import { ProjectHeader } from '@/components/layout/project-header';
import { MobileSidebar } from '@/components/layout/mobile-sidebar';
import { AdminModeBanner } from '@/components/admin/admin-mode-banner';
import { CallClientWrapper } from '@/components/calls/call-client-wrapper';
import { ChatPanel } from '@/components/chat/chat-panel';
import { LastProjectTracker } from '@/components/projects/last-project-tracker';
import type { Database } from '@/types/database';
import type { ProjectRole } from '@/types/user';

type Project = Database['public']['Tables']['projects']['Row'];

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch the project
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (error || !project) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;

  const [{ data: membership }, { data: overrides }] = await Promise.all([
    supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single(),
    supabaseAny
      .from('project_membership_overrides')
      .select('resource, granted')
      .eq('project_id', project.id)
      .eq('user_id', user.id),
  ]);

  if (project.project_type === 'community' && membership?.role === 'contractor') {
    redirect(`/contractor/${slug}`);
  }

  const deniedResources: string[] = (overrides ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((o: any) => o.granted === false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((o: any) => o.resource as string);

  // Check for active admin session (uses admin client to bypass RLS)
  let adminSession: { id: string } | null = null;
  try {
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from('system_admin_sessions')
      .select('id')
      .eq('admin_user_id', user.id)
      .eq('project_id', project.id)
      .is('exited_at', null)
      .maybeSingle();
    adminSession = data;
  } catch {
    // Silently ignore — admin banner is non-critical
  }

  return (
    <CallClientWrapper>
      <div className="flex h-screen bg-background">
        <LastProjectTracker projectSlug={project.slug} />
        <ProjectSidebar project={project as Project} role={membership?.role as ProjectRole | undefined} deniedResources={deniedResources} />
        <MobileSidebar>
          <ProjectSidebar project={project as Project} role={membership?.role as ProjectRole | undefined} deniedResources={deniedResources} className="flex w-full border-r-0" />
        </MobileSidebar>
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <ProjectHeader project={project as Project} />
          {adminSession && <AdminModeBanner projectId={project.id} projectName={project.name} />}
          <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
      <ChatPanel projectSlug={slug} projectType={project.project_type} />
    </CallClientWrapper>
  );
}
