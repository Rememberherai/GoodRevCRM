import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KioskClient } from '@/components/community/employees/kiosk-client';

interface KioskPageProps {
  params: Promise<{ slug: string }>;
}

export default async function KioskPage({ params }: KioskPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, slug, project_type')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!project || project.project_type !== 'community') notFound();

  return <KioskClient projectName={project.name} projectSlug={project.slug} />;
}
