import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProgramsServicesPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/projects/${slug}/programs-services/programs`);
}
