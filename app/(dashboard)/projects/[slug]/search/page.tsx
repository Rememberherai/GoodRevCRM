'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Building2, Users, Target, FileText, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SearchResult {
  id: string;
  type: 'organization' | 'person' | 'opportunity' | 'rfp';
  title: string;
  subtitle?: string;
}

const typeIcons = {
  organization: Building2,
  person: Users,
  opportunity: Target,
  rfp: FileText,
};

const typeLabels = {
  organization: 'Organization',
  person: 'Person',
  opportunity: 'Opportunity',
  rfp: 'RFP',
};

export default function SearchPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await fetch(
        `/api/projects/${slug}/search?query=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const getLink = (result: SearchResult) => {
    const base = `/projects/${slug}`;
    switch (result.type) {
      case 'organization':
        return `${base}/organizations/${result.id}`;
      case 'person':
        return `${base}/people/${result.id}`;
      case 'opportunity':
        return `${base}/opportunities/${result.id}`;
      case 'rfp':
        return `${base}/rfps/${result.id}`;
      default:
        return base;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Search</h2>
        <p className="text-muted-foreground">
          Search across organizations, people, opportunities, and RFPs
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex items-center gap-4">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, domain..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>
        <Button type="submit" disabled={isSearching || !query.trim()}>
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            'Search'
          )}
        </Button>
      </form>

      {isSearching && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isSearching && hasSearched && results.length === 0 && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>No results found</CardTitle>
            <CardDescription>
              Try adjusting your search terms or check for typos.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!isSearching && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </p>
          <div className="space-y-2">
            {results.map((result) => {
              const Icon = typeIcons[result.type];
              return (
                <Link
                  key={`${result.type}-${result.id}`}
                  href={getLink(result)}
                  className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.title}</p>
                    {result.subtitle && (
                      <p className="text-sm text-muted-foreground truncate">
                        {result.subtitle}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary">{typeLabels[result.type]}</Badge>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {!hasSearched && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Global Search</CardTitle>
            <CardDescription>
              Enter a search term above to find organizations, people, opportunities, and RFPs.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
