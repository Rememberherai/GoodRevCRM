'use client';

import { useState, useCallback } from 'react';
import { Newspaper, RefreshCw, Loader2, Check, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface OrgNewsFetchCardProps {
  projectSlug: string;
  organizationId: string;
  organizationName: string;
  onFetchComplete?: () => void;
}

interface FetchResult {
  fetched: number;
  tokensUsed: number;
  tokensRemaining: number;
  errors?: string[];
}

export function OrgNewsFetchCard({
  projectSlug,
  organizationId,
  organizationName,
  onFetchComplete,
}: OrgNewsFetchCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<FetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/organizations/${organizationId}/news/fetch`,
        { method: 'POST' }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch news');
      }

      setLastResult(data);

      if (data.fetched > 0) {
        toast.success(`Found ${data.fetched} news article${data.fetched === 1 ? '' : 's'} for ${organizationName}`);
      } else {
        toast.info(`No new articles found for ${organizationName}`);
      }

      if (data.errors?.length) {
        console.warn('[OrgNewsFetch] Errors:', data.errors);
      }

      onFetchComplete?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to fetch news';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectSlug, organizationId, organizationName, onFetchComplete]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Newspaper className="h-4 w-4" />
              Fetch News
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Search for news articles mentioning this organization
            </CardDescription>
          </div>
          <Button
            onClick={handleFetch}
            disabled={isLoading}
            size="sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Fetch News
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {(lastResult || error) && (
        <CardContent className="pt-0">
          {error ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : lastResult && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-green-500" />
                <span>{lastResult.fetched} article{lastResult.fetched === 1 ? '' : 's'} found</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {lastResult.tokensRemaining} tokens remaining
              </Badge>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
