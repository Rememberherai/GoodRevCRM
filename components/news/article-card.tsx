'use client';

import { Star, Clock, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NewsArticle } from '@/types/news';

interface ArticleCardProps {
  article: NewsArticle;
  onToggleStar: (id: string, isStarred: boolean) => void;
  onClick: (article: NewsArticle) => void;
  compact?: boolean;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ArticleCard({ article, onToggleStar, onClick, compact }: ArticleCardProps) {
  const description = article.description || article.body?.slice(0, 200) || '';

  if (compact) {
    return (
      <button
        onClick={() => onClick(article)}
        className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors border border-border"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium line-clamp-1">{article.title}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {article.source_name && <span>{article.source_name}</span>}
              {article.published_at && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span>{timeAgo(article.published_at)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <Card
      className={cn(
        'cursor-pointer hover:border-primary/50 transition-colors',
        article.is_read && 'opacity-75'
      )}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <button
                onClick={() => onClick(article)}
                className="text-left flex-1 min-w-0"
              >
                <h3 className="font-medium text-sm line-clamp-2 hover:text-primary transition-colors">
                  {article.title}
                </h3>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(article.id, article.is_starred);
                }}
              >
                <Star
                  className={cn(
                    'h-4 w-4',
                    article.is_starred
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground'
                  )}
                />
              </Button>
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {article.source_name && <span>{article.source_name}</span>}
              {article.published_at && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <Clock className="h-3 w-3" />
                  <span>{timeAgo(article.published_at)}</span>
                </>
              )}
              {article.author && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span>{article.author}</span>
                </>
              )}
            </div>

            {description && (
              <button
                onClick={() => onClick(article)}
                className="text-left w-full"
              >
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                  {description}
                </p>
              </button>
            )}

            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {article.matched_keywords?.slice(0, 3).map((kw) => (
                <Badge key={kw} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {kw}
                </Badge>
              ))}
              {(article.matched_keywords?.length || 0) > 3 && (
                <span className="text-[10px] text-muted-foreground">
                  +{article.matched_keywords.length - 3}
                </span>
              )}
              {article.linked_organizations?.map((org) => (
                <Badge key={org.id} variant="outline" className="text-[10px] px-1.5 py-0">
                  <Building2 className="h-2.5 w-2.5 mr-0.5" />
                  {org.name}
                </Badge>
              ))}
            </div>
          </div>

          {article.image_url && (
            <button
              onClick={() => onClick(article)}
              className="shrink-0 hidden sm:block"
            >
              <img
                src={article.image_url}
                alt=""
                className="w-24 h-24 object-cover rounded-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
