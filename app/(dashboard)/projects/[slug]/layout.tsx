import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { ProjectSidebar } from '@/components/layout/project-sidebar';
import { ProjectHeader } from '@/components/layout/project-header';
import { CallClientWrapper } from '@/components/calls/call-client-wrapper';
import type { Database } from '@/types/database';

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

  return (
    <CallClientWrapper>
      <div className="flex h-screen bg-background">
        <ProjectSidebar project={project as Project} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <ProjectHeader project={project as Project} />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </CallClientWrapper>
  );
}
