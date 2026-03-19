'use client';

import { useState } from 'react';
import { Search, Star, Filter, ChevronsUpDown, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
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
  const [open, setOpen] = useState(false);

  const handleSearchSubmit = () => {
    onSearchChange(searchInput);
  };

  return (
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

      {keywords.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 min-w-[160px] justify-between">
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-xs">
                {selectedKeyword || 'All keywords'}
              </span>
              {selectedKeyword ? (
                <X
                  className="h-3.5 w-3.5 shrink-0 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onKeywordChange(undefined);
                  }}
                />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="end">
            <Command>
              <CommandInput placeholder="Search keywords..." />
              <CommandList>
                <CommandEmpty>No keyword found.</CommandEmpty>
                <CommandGroup>
                  {keywords.map((kw) => (
                    <CommandItem
                      key={kw}
                      value={kw}
                      onSelect={() => {
                        onKeywordChange(selectedKeyword === kw ? undefined : kw);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn(
                        "mr-2 h-3.5 w-3.5",
                        selectedKeyword === kw ? "opacity-100" : "opacity-0"
                      )} />
                      <span className="truncate">{kw}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

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
  );
}
