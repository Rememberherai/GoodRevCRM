'use client';

import { useState, useMemo } from 'react';
import { Plus, X, Building2, RefreshCw, ChevronDown, ChevronUp, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
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
  const [fetchResult, setFetchResult] = useState<string | null>(null);
  const [orgSearch, setOrgSearch] = useState('');
  const [showAllOrgs, setShowAllOrgs] = useState(false);

  const manualKeywords = keywords.filter(k => k.source === 'manual');
  const orgKeywords = keywords.filter(k => k.source === 'organization');

  const filteredOrgKeywords = useMemo(() => {
    if (!orgSearch.trim()) return orgKeywords;
    const search = orgSearch.toLowerCase();
    return orgKeywords.filter(kw => kw.keyword.toLowerCase().includes(search));
  }, [orgKeywords, orgSearch]);

  const activeOrgCount = orgKeywords.filter(k => k.is_active).length;
  const COLLAPSED_LIMIT = 12;

  const handleAdd = async () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    const success = await addKeyword(trimmed);
    if (success) {
      setNewKeyword('');
    }
  };

  const handleFetch = async () => {
    setFetchResult(null);
    const result = await fetchNews();
    if (result) {
      if (result.fetched > 0) {
        setFetchResult(`Found ${result.fetched} article${result.fetched === 1 ? '' : 's'}`);
      } else if (result.errors?.length) {
        setFetchResult(`No articles found. Errors: ${result.errors.join('; ')}`);
      } else {
        setFetchResult('No new articles found for your keywords');
      }
      onFetchComplete?.();
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

          {fetchResult && !error && (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">{fetchResult}</p>
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Organization Keywords
                  <span className="ml-1.5 text-muted-foreground/70">
                    ({activeOrgCount} of {orgKeywords.length} active)
                  </span>
                </p>
                {orgKeywords.length > COLLAPSED_LIMIT && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setShowAllOrgs(!showAllOrgs)}
                  >
                    {showAllOrgs ? 'Show less' : `Show all ${orgKeywords.length}`}
                  </Button>
                )}
              </div>

              {/* Search input for many organizations */}
              {orgKeywords.length > COLLAPSED_LIMIT && showAllOrgs && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search organizations..."
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    className="h-8 pl-8 text-sm"
                  />
                </div>
              )}

              {/* Organization badges grid */}
              <ScrollArea className={cn(
                showAllOrgs && orgKeywords.length > COLLAPSED_LIMIT ? 'h-[200px]' : ''
              )}>
                <div className="flex flex-wrap gap-1.5">
                  {(showAllOrgs ? filteredOrgKeywords : orgKeywords.slice(0, COLLAPSED_LIMIT)).map((kw) => (
                    <button
                      key={kw.id}
                      onClick={() => toggleKeyword(kw.id, kw.is_active)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                        "border hover:bg-accent",
                        kw.is_active
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "bg-muted/50 border-transparent text-muted-foreground"
                      )}
                    >
                      {kw.is_active ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Building2 className="h-3 w-3" />
                      )}
                      {kw.keyword}
                    </button>
                  ))}
                  {!showAllOrgs && orgKeywords.length > COLLAPSED_LIMIT && (
                    <button
                      onClick={() => setShowAllOrgs(true)}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent border border-dashed"
                    >
                      +{orgKeywords.length - COLLAPSED_LIMIT} more
                    </button>
                  )}
                </div>
              </ScrollArea>

              {showAllOrgs && orgSearch && filteredOrgKeywords.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No organizations match &ldquo;{orgSearch}&rdquo;
                </p>
              )}
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
