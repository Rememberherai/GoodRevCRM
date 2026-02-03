import { createClient } from '@/lib/supabase/server';
import { SequencesPageClient } from './sequences-page-client';
import type { CompanyContext } from '@/lib/validators/project';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SequencesPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Get project with settings for company context
  const { data: project } = await supabase
    .from('projects')
    .select('id, settings')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) {
    return <div>Project not found</div>;
  }

  // Fetch initial sequences
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;

  const { data: sequences } = await supabaseAny
    .from('sequences')
    .select(`
      *,
      steps:sequence_steps(count),
      enrollments:sequence_enrollments(count)
    `)
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });

  // Extract company context from project settings
  const settings = project.settings as { company_context?: CompanyContext } | null;
  const companyContext = settings?.company_context;

  return (
    <SequencesPageClient
      projectSlug={slug}
      initialSequences={sequences ?? []}
      companyContext={companyContext}
    />
  );
}
