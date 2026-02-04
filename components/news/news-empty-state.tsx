'use client';

import { Newspaper } from 'lucide-react';

interface NewsEmptyStateProps {
  hasKeywords?: boolean;
}

export function NewsEmptyState({ hasKeywords }: NewsEmptyStateProps) {
  return (
    <div className="text-center py-12">
      <Newspaper className="h-10 w-10 mx-auto text-muted-foreground/50" />
      <h3 className="mt-3 text-sm font-medium">No articles found</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasKeywords
          ? 'No articles match your current filters. Try adjusting your search or keywords.'
          : 'Add keywords above to start tracking relevant news articles. You can also add organization names to automatically track news about your accounts.'}
      </p>
    </div>
  );
}
