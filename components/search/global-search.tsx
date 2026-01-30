'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Loader2,
  User,
  Building2,
  Target,
  FileText,
  CheckSquare,
  StickyNote,
  X,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useDebounce } from '@/hooks/use-debounce';

interface SearchResult {
  id: string;
  type: 'person' | 'organization' | 'opportunity' | 'rfp' | 'task' | 'note';
  title: string;
  subtitle: string | null;
  metadata: Record<string, unknown>;
}

interface GlobalSearchProps {
  projectSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeConfig = {
  person: { icon: User, label: 'People', path: 'people' },
  organization: { icon: Building2, label: 'Organizations', path: 'organizations' },
  opportunity: { icon: Target, label: 'Opportunities', path: 'opportunities' },
  rfp: { icon: FileText, label: 'RFPs', path: 'rfps' },
  task: { icon: CheckSquare, label: 'Tasks', path: 'tasks' },
  note: { icon: StickyNote, label: 'Notes', path: 'notes' },
};

export function GlobalSearch({ projectSlug, open, onOpenChange }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/search?query=${encodeURIComponent(searchQuery)}`
      );

      if (response.ok) {
        const data = await response.json();
        setResults(data.results ?? []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  const handleSelect = (result: SearchResult) => {
    const config = typeConfig[result.type];
    if (config) {
      router.push(`/projects/${projectSlug}/${config.path}/${result.id}`);
      onOpenChange(false);
    }
  };

  // Group results by type
  const groupedResults: Record<string, SearchResult[]> = {};
  for (const result of results) {
    const key = result.type;
    if (!groupedResults[key]) {
      groupedResults[key] = [];
    }
    (groupedResults[key] as SearchResult[]).push(result);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center border-b px-3">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <input
          placeholder="Search people, organizations, opportunities..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {query && !loading && (
          <button
            onClick={() => setQuery('')}
            className="rounded-sm opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <CommandList>
        {query && !loading && results.length === 0 && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}

        {Object.entries(groupedResults).map(([type, items]) => {
          const config = typeConfig[type as keyof typeof typeConfig];
          if (!config || !items || items.length === 0) return null;

          const Icon = config.icon;

          return (
            <CommandGroup key={type} heading={config.label}>
              {items.map((result) => (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  value={`${result.type}-${result.id}-${result.title}`}
                  onSelect={() => handleSelect(result)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{result.title}</span>
                    {result.subtitle && (
                      <span className="text-xs text-muted-foreground">
                        {result.subtitle}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
