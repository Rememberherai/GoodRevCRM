import { Suspense } from 'react';
import { NewsPageClient } from './news-page-client';

interface NewsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewsPage({ params }: NewsPageProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Loading...</div>}>
      <NewsPageClient projectSlug={slug} />
    </Suspense>
  );
}
