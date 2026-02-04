'use client';

import { useState } from 'react';
import { Search, Star, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NewsFiltersProps {
  keywords: string[];
  selectedKeyword: string | undefined;
  onKeywordChange: (keyword: string | undefined) => void;
  starred: boolean;
  onStarredChange: (starred: boolean) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

export function NewsFilters({
  keywords,
  selectedKeyword,
  onKeywordChange,
  starred,
  onStarredChange,
  search,
  onSearchChange,
}: NewsFiltersProps) {
  const [searchInput, setSearchInput] = useState(search);

  const handleSearchSubmit = () => {
    onSearchChange(searchInput);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
            className="pl-8 h-9"
          />
        </div>
        <Button
          variant={starred ? 'default' : 'outline'}
          size="sm"
          onClick={() => onStarredChange(!starred)}
          className="h-9"
        >
          <Star className={cn('h-3.5 w-3.5 mr-1.5', starred && 'fill-current')} />
          Starred
        </Button>
      </div>

      {keywords.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Badge
            variant={!selectedKeyword ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => onKeywordChange(undefined)}
          >
            All
          </Badge>
          {keywords.map((kw) => (
            <Badge
              key={kw}
              variant={selectedKeyword === kw ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => onKeywordChange(selectedKeyword === kw ? undefined : kw)}
            >
              {kw}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
