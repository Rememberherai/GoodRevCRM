import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { CallClientWrapper } from '@/components/calls/call-client-wrapper';
import { ChatPanel } from '@/components/chat/chat-panel';
import { LastProjectTracker } from '@/components/projects/last-project-tracker';
import { ContractorPortalHeader } from '@/components/layout/contractor-portal-header';

interface ContractorLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function ContractorLayout({ children, params }: ContractorLayoutProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, slug, project_type')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (error || !project) {
    notFound();
  }

  const { data: membership } = await supabase
    .from('project_memberships')
    .select('role')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    redirect('/projects');
  }

  const isAdmin = membership.role === 'owner' || membership.role === 'admin';

  if (membership.role !== 'contractor' && !isAdmin) {
    redirect(`/projects/${slug}`);
  }

  return (
    <CallClientWrapper>
      <div className="flex min-h-screen flex-col bg-background">
        <LastProjectTracker projectSlug={project.slug} />
        <ContractorPortalHeader projectName={project.name} projectSlug={project.slug} />
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
      <ChatPanel projectSlug={slug} projectType={project.project_type} />
    </CallClientWrapper>
  );
}
