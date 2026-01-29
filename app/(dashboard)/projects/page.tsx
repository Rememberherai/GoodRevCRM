import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProjectsPageClient } from './projects-page-client';
import type { Database } from '@/types/database';

type Project = Database['public']['Tables']['projects']['Row'];

export default async function ProjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch user's projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return <ProjectsPageClient projects={(projects as Project[]) ?? []} />;
}
