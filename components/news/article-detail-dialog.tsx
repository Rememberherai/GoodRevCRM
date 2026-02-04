'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, ExternalLink, Clock, Building2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NewsArticle } from '@/types/news';

interface ArticleDetailDialogProps {
  article: NewsArticle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleStar: (id: string, isStarred: boolean) => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ArticleDetailDialog({
  article,
  open,
  onOpenChange,
  onToggleStar,
}: ArticleDetailDialogProps) {
  if (!article) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <DialogTitle className="text-lg leading-snug pr-8">
              {article.title}
            </DialogTitle>
          </div>
        </DialogHeader>

        {article.image_url && (
          <img
            src={article.image_url}
            alt=""
            className="w-full h-48 object-cover rounded-md"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          {article.source_name && (
            <span className="font-medium text-foreground">{article.source_name}</span>
          )}
          {article.author && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {article.author}
              </span>
            </>
          )}
          {article.published_at && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(article.published_at)}
              </span>
            </>
          )}
        </div>

        {/* Keywords and org badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {article.matched_keywords?.map((kw) => (
            <Badge key={kw} variant="secondary" className="text-xs">
              {kw}
            </Badge>
          ))}
          {article.linked_organizations?.map((org) => (
            <Badge key={org.id} variant="outline" className="text-xs">
              <Building2 className="h-3 w-3 mr-1" />
              {org.name}
            </Badge>
          ))}
          {article.sentiment !== null && article.sentiment !== undefined && (
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                article.sentiment > 0
                  ? 'border-green-500/30 text-green-700'
                  : article.sentiment < 0
                    ? 'border-red-500/30 text-red-700'
                    : ''
              )}
            >
              Sentiment: {article.sentiment > 0 ? '+' : ''}{article.sentiment.toFixed(2)}
            </Badge>
          )}
        </div>

        {/* Article body */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {article.body ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {article.body}
            </div>
          ) : article.description ? (
            <p className="text-sm text-muted-foreground">{article.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Full article content not available. Click below to read the full article.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            variant="default"
            size="sm"
            onClick={() => window.open(article.url, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Read Full Article
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleStar(article.id, article.is_starred)}
          >
            <Star
              className={cn(
                'h-4 w-4 mr-2',
                article.is_starred
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground'
              )}
            />
            {article.is_starred ? 'Starred' : 'Star'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
