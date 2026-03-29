import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CommunicationsPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/projects/${slug}/communications/broadcasts`);
}
