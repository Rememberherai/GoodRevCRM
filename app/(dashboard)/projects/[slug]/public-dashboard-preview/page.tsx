import { redirect } from 'next/navigation';

interface PreviewPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicDashboardPreviewPage({ params }: PreviewPageProps) {
  const { slug } = await params;
  redirect(`/projects/${slug}/settings/public-dashboard`);
}
