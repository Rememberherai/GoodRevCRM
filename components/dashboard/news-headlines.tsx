'use client';

import { useState } from 'react';
import { Newspaper, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNews } from '@/hooks/use-news';
import { ArticleCard } from '@/components/news/article-card';
import { ArticleDetailDialog } from '@/components/news/article-detail-dialog';
import type { NewsArticle } from '@/types/news';
import Link from 'next/link';

interface NewsHeadlinesProps {
  projectSlug: string;
}

export function NewsHeadlines({ projectSlug }: NewsHeadlinesProps) {
  const { articles, isLoading, toggleStar, markAsRead } = useNews({
    projectSlug,
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

  // Don't render if no articles (no keywords set, or no results yet)
  if (isLoading || articles.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Newspaper className="h-4 w-4" />
            Latest News
          </CardTitle>
          <Link href={`/projects/${projectSlug}/news`}>
            <Button variant="ghost" size="sm" className="text-xs h-7">
              Find More <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {articles.slice(0, 3).map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            onToggleStar={handleToggleStar}
            onClick={handleArticleClick}
            compact
          />
        ))}

        <ArticleDetailDialog
          article={selectedArticle}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onToggleStar={handleToggleStar}
        />
      </CardContent>
    </Card>
  );
}
