'use client';

import { useState } from 'react';
import { Newspaper, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  // Don't render if no articles and not loading
  if (!isLoading && articles.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Newspaper className="h-4 w-4" />
            Related News
          </CardTitle>
          <Link href={`/projects/${projectSlug}/news`}>
            <Button variant="ghost" size="sm" className="text-xs h-7">
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading news...
          </div>
        ) : (
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
        )}
      </CardContent>

      <ArticleDetailDialog
        article={selectedArticle}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onToggleStar={handleToggleStar}
      />
    </Card>
  );
}
