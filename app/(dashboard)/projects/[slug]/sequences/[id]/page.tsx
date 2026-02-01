import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { SequenceDetailClient } from './sequence-detail-client';

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function SequenceDetailPage({ params }: PageProps) {
  const { slug, id } = await params;
  const supabase = await createClient();

  // Get project
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project) {
    notFound();
  }

  // Fetch sequence with steps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;

  const { data: sequence, error } = await supabaseAny
    .from('sequences')
    .select(`
      *,
      steps:sequence_steps(*)
    `)
    .eq('id', id)
    .eq('project_id', project.id)
    .single();

  if (error || !sequence) {
    notFound();
  }

  // Sort steps by step_number
  if (sequence.steps) {
    sequence.steps.sort((a: { step_number: number }, b: { step_number: number }) =>
      a.step_number - b.step_number
    );
  }

  return (
    <SequenceDetailClient
      sequence={sequence}
      projectSlug={slug}
    />
  );
}
