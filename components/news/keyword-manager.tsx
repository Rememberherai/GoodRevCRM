'use client';

import { useState } from 'react';
import { Plus, X, Building2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNewsKeywords } from '@/hooks/use-news-keywords';
import { NewsTokenUsage } from './news-token-usage';

interface KeywordManagerProps {
  projectSlug: string;
  onFetchComplete?: () => void;
}

export function KeywordManager({ projectSlug, onFetchComplete }: KeywordManagerProps) {
  const {
    keywords,
    isLoading,
    error,
    tokenUsage,
    addKeyword,
    removeKeyword,
    toggleKeyword,
    fetchNews,
    isFetching,
  } = useNewsKeywords({ projectSlug });

  const [newKeyword, setNewKeyword] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const manualKeywords = keywords.filter(k => k.source === 'manual');
  const orgKeywords = keywords.filter(k => k.source === 'organization');

  const handleAdd = async () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    const success = await addKeyword(trimmed);
    if (success) {
      setNewKeyword('');
    }
  };

  const handleFetch = async () => {
    const result = await fetchNews();
    if (result && onFetchComplete) {
      onFetchComplete();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">News Keywords</CardTitle>
            {tokenUsage && <NewsTokenUsage usage={tokenUsage} />}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleFetch}
              disabled={isFetching || keywords.filter(k => k.is_active).length === 0}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Fetching...' : 'Fetch Now'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Add keyword input */}
          <div className="flex gap-2">
            <Input
              placeholder="Add a keyword (e.g., wastewater regulation)"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="h-9"
            />
            <Button size="sm" onClick={handleAdd} disabled={!newKeyword.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Manual keywords */}
          {manualKeywords.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Manual Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {manualKeywords.map((kw) => (
                  <Badge
                    key={kw.id}
                    variant={kw.is_active ? 'default' : 'outline'}
                    className="gap-1 pr-1"
                  >
                    {kw.keyword}
                    <button
                      onClick={() => removeKeyword(kw.id)}
                      className="ml-0.5 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Org keywords */}
          {orgKeywords.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Organization Keywords (auto-tracked)
              </p>
              <div className="space-y-1.5">
                {orgKeywords.map((kw) => (
                  <div
                    key={kw.id}
                    className="flex items-center justify-between py-1 px-2 rounded-md bg-muted/50"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {kw.keyword}
                    </div>
                    <Switch
                      checked={kw.is_active}
                      onCheckedChange={() => toggleKeyword(kw.id, kw.is_active)}
                      className="scale-75"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isLoading && keywords.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Add keywords to start tracking relevant news articles.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
