'use client';

import { useState } from 'react';
import { Newspaper, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNews } from '@/hooks/use-news';
import { ArticleCard } from './article-card';
import { ArticleDetailDialog } from './article-detail-dialog';
import type { NewsArticle } from '@/types/news';
import Link from 'next/link';

interface OrgNewsSectionProps {
  projectSlug: string;
  organizationId: string;
}

export function OrgNewsSection({ projectSlug, organizationId }: OrgNewsSectionProps) {
  const { articles, isLoading, toggleStar, markAsRead } = useNews({
    projectSlug,
    orgId: organizationId,
    limit: 3,
  });

  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleArticleClick = (article: NewsArticle) => {
    setSelectedArticle(article);
    setDialogOpen(true);
    if (!article.is_read) {
      markAsRead(article.id);
    }
  };

  const handleToggleStar = (id: string, isStarred: boolean) => {
    toggleStar(id, isStarred);
    if (selectedArticle?.id === id) {
      setSelectedArticle(prev => prev ? { ...prev, is_starred: !isStarred } : null);
    }
  };

  // Don't render if no articles
  if (isLoading || articles.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Newspaper className="h-4 w-4" />
          Related News
        </h3>
        <Link href={`/projects/${projectSlug}/news`}>
          <Button variant="ghost" size="sm" className="text-xs h-7">
            Find More <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="space-y-2">
        {articles.slice(0, 3).map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            onToggleStar={handleToggleStar}
            onClick={handleArticleClick}
            compact
          />
        ))}
      </div>

      <ArticleDetailDialog
        article={selectedArticle}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onToggleStar={handleToggleStar}
      />
    </div>
  );
}
