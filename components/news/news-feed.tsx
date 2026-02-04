'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNews } from '@/hooks/use-news';
import { ArticleCard } from './article-card';
import { ArticleDetailDialog } from './article-detail-dialog';
import { NewsEmptyState } from './news-empty-state';
import type { NewsArticle } from '@/types/news';

interface NewsFeedProps {
  projectSlug: string;
  keyword?: string;
  starred?: boolean;
  search?: string;
  orgId?: string;
  refreshKey?: number;
}

export function NewsFeed({ projectSlug, keyword, starred, search, orgId, refreshKey: _refreshKey }: NewsFeedProps) {
  const {
    articles,
    isLoading,
    error,
    loadMore,
    hasMore,
    total,
    toggleStar,
    markAsRead,
    refresh,
  } = useNews({ projectSlug, keyword, starred, search, orgId });

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={refresh}>
          Try Again
        </Button>
      </div>
    );
  }

  if (articles.length === 0) {
    return <NewsEmptyState hasKeywords={!!keyword || !!search} />;
  }

  return (
    <div className="space-y-3">
      {total > 0 && (
        <p className="text-xs text-muted-foreground">
          {total} article{total !== 1 ? 's' : ''} found
        </p>
      )}

      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          onToggleStar={handleToggleStar}
          onClick={handleArticleClick}
        />
      ))}

      {hasMore && (
        <div className="text-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMore}>
            Load More
          </Button>
        </div>
      )}

      <ArticleDetailDialog
        article={selectedArticle}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onToggleStar={handleToggleStar}
      />
    </div>
  );
}
