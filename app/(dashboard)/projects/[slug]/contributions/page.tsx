import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ContributionsPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/projects/${slug}/contributions/donations`);
}
