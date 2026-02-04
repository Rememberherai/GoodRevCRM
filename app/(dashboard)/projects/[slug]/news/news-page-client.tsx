'use client';

import { useState, useCallback } from 'react';
import { KeywordManager } from '@/components/news/keyword-manager';
import { NewsFeed } from '@/components/news/news-feed';
import { NewsFilters } from '@/components/news/news-filters';
import { useNewsKeywords } from '@/hooks/use-news-keywords';

interface NewsPageClientProps {
  projectSlug: string;
}

export function NewsPageClient({ projectSlug }: NewsPageClientProps) {
  const { keywords } = useNewsKeywords({ projectSlug });
  const [selectedKeyword, setSelectedKeyword] = useState<string | undefined>();
  const [starred, setStarred] = useState(false);
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const activeKeywords = keywords.filter(k => k.is_active).map(k => k.keyword);

  const handleFetchComplete = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">News</h2>
        <p className="text-muted-foreground">
          Track industry news and mentions of your accounts
        </p>
      </div>

      <KeywordManager
        projectSlug={projectSlug}
        onFetchComplete={handleFetchComplete}
      />

      <NewsFilters
        keywords={activeKeywords}
        selectedKeyword={selectedKeyword}
        onKeywordChange={setSelectedKeyword}
        starred={starred}
        onStarredChange={setStarred}
        search={search}
        onSearchChange={setSearch}
      />

      <NewsFeed
        projectSlug={projectSlug}
        keyword={selectedKeyword}
        starred={starred || undefined}
        search={search || undefined}
        refreshKey={refreshKey}
      />
    </div>
  );
}
