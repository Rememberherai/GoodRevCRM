import { createClient } from '@/lib/supabase/server';
import { SequencesPageClient } from './sequences-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SequencesPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Get project
  const { data: project } = await supabase
    .from('projects')
    .select('id')
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

  return (
    <SequencesPageClient
      projectSlug={slug}
      initialSequences={sequences ?? []}
    />
  );
}
