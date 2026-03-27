import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { EmployeePortalHeader } from '@/components/layout/employee-portal-header';

interface EmployeeLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function EmployeeLayout({ children, params }: EmployeeLayoutProps) {
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

  // Require project membership (any role)
  const { data: membership } = await supabase
    .from('project_memberships')
    .select('role')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    redirect('/projects');
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <EmployeePortalHeader projectName={project.name} projectSlug={project.slug} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
