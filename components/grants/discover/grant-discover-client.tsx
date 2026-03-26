'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Search, Globe, Link2, Loader2, ExternalLink, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface SearchResult {
  title: string;
  funder?: string;
  url?: string;
  amount?: string | null;
  deadline?: string | null;
  description?: string;
  eligibility?: string;
}

interface ScrapeResult {
  name?: string;
  funder_name?: string;
  amount?: string;
  amount_value?: number | null;
  deadline?: string;
  description?: string;
  eligibility?: string;
  focus_areas?: string;
}

export function GrantDiscoverClient() {
  const { slug } = useParams<{ slug: string }>();
  const [activeTab, setActiveTab] = useState('search');

  // Web Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // URL Scraper state
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [scrapeSourceUrl, setScrapeSourceUrl] = useState('');

  // Saving state
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [scrapeSaving, setScrapeSaving] = useState(false);
  const [scrapeSaved, setScrapeSaved] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);

    try {
      const res = await fetch(`/api/projects/${slug}/grants/discover/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Search failed'); }
      const data = await res.json();
      setSearchResults(data.opportunities ?? []);
      if ((data.opportunities ?? []).length === 0) {
        toast.info('No results found. Try different keywords.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    setScrapeResult(null);
    setScrapeSaved(false);

    try {
      const res = await fetch(`/api/projects/${slug}/grants/discover/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Scraping failed'); }
      const data = await res.json();
      setScrapeResult(data.extracted);
      setScrapeSourceUrl(data.source_url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to scrape URL');
    } finally {
      setScraping(false);
    }
  };

  const saveDiscoveredGrant = async (grantData: {
    name: string;
    funder_name?: string;
    amount_requested?: number | null;
    application_due_at?: string | null;
    notes?: string;
    source_url?: string;
  }, index?: number) => {
    if (index !== undefined) {
      setSavingIds(prev => new Set(prev).add(index));
    } else {
      setScrapeSaving(true);
    }

    try {
      const rows = [{
        name: grantData.name,
        status: 'researching',
        amount_requested: grantData.amount_requested,
        application_due_at: grantData.application_due_at,
        notes: grantData.notes,
        funder_name: grantData.funder_name,
        source_url: grantData.source_url,
        is_discovered: true,
      }];

      const res = await fetch(`/api/projects/${slug}/grants/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });

      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to save'); }
      const data = await res.json();

      if (data.successful > 0) {
        toast.success(`"${grantData.name}" saved to discovered grants`);
        if (index !== undefined) {
          setSavedIds(prev => new Set(prev).add(index));
        } else {
          setScrapeSaved(true);
        }
      } else {
        throw new Error(data.results?.[0]?.error || 'Import failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save grant');
    } finally {
      if (index !== undefined) {
        setSavingIds(prev => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      } else {
        setScrapeSaving(false);
      }
    }
  };

  const parseAmount = (amountStr?: string | null): number | null => {
    if (!amountStr) return null;
    const cleaned = amountStr.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const parseDeadline = (deadlineStr?: string | null): string | null => {
    if (!deadlineStr) return null;
    // Try parsing as date
    const d = new Date(deadlineStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Search className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Discover Grants</h2>
          <p className="text-sm text-muted-foreground">
            Search the web, scrape funder pages, or browse federal opportunities
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="search">
            <Globe className="mr-2 h-4 w-4" />
            Web Search
          </TabsTrigger>
          <TabsTrigger value="scrape">
            <Link2 className="mr-2 h-4 w-4" />
            URL Scraper
          </TabsTrigger>
        </TabsList>

        {/* Web Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder='Search for grants, e.g. "youth mentoring grants 2026" or "environmental justice funding"'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              disabled={searching}
            />
            <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          {searching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching the web for grant opportunities...
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-3">
              {searchResults.map((result, i) => (
                <Card key={i}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{result.title || 'Untitled'}</h3>
                          {result.url && (
                            <a href={result.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </a>
                          )}
                        </div>
                        {result.funder && (
                          <p className="text-sm text-muted-foreground">{result.funder}</p>
                        )}
                        {result.description && (
                          <p className="text-sm mt-1">{result.description}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          {result.amount && <Badge variant="secondary">{result.amount}</Badge>}
                          {result.deadline && <Badge variant="outline">Due: {result.deadline}</Badge>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={savedIds.has(i) ? 'ghost' : 'outline'}
                        disabled={savingIds.has(i) || savedIds.has(i)}
                        onClick={() => saveDiscoveredGrant({
                          name: result.title || 'Untitled Grant',
                          funder_name: result.funder,
                          amount_requested: parseAmount(result.amount),
                          application_due_at: parseDeadline(result.deadline),
                          notes: result.description,
                          source_url: result.url,
                        }, i)}
                      >
                        {savingIds.has(i) ? <Loader2 className="h-4 w-4 animate-spin" /> : savedIds.has(i) ? <span className="text-green-600">Saved</span> : <><Plus className="h-4 w-4" /><span className="ml-1">Save</span></>}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* URL Scraper Tab */}
        <TabsContent value="scrape" className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Paste a funder URL to extract grant details..."
              value={scrapeUrl}
              onChange={e => setScrapeUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScrape()}
              disabled={scraping}
            />
            <Button onClick={handleScrape} disabled={scraping || !scrapeUrl.trim()}>
              {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              <span className="ml-2">Extract</span>
            </Button>
          </div>

          {scraping && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching and analyzing page content...
            </div>
          )}

          {scrapeResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{scrapeResult.name || 'Extracted Grant Details'}</CardTitle>
                {scrapeResult.funder_name && (
                  <CardDescription>{scrapeResult.funder_name}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {scrapeResult.description && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{scrapeResult.description}</p>
                  </div>
                )}
                <div className="flex gap-4 flex-wrap">
                  {scrapeResult.amount && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Amount</p>
                      <p className="text-sm font-medium">{scrapeResult.amount}</p>
                    </div>
                  )}
                  {scrapeResult.deadline && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Deadline</p>
                      <p className="text-sm font-medium">{scrapeResult.deadline}</p>
                    </div>
                  )}
                </div>
                {scrapeResult.eligibility && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Eligibility</p>
                    <p className="text-sm">{scrapeResult.eligibility}</p>
                  </div>
                )}
                {scrapeResult.focus_areas && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Focus Areas</p>
                    <p className="text-sm">{scrapeResult.focus_areas}</p>
                  </div>
                )}

                {!scrapeResult.name && (
                  <div className="flex items-center gap-2 text-sm text-amber-500">
                    <AlertCircle className="h-4 w-4" />
                    Could not extract grant details from this page. Try a different URL.
                  </div>
                )}

                {scrapeResult.name && (
                  <Button
                    className="mt-2"
                    disabled={scrapeSaving || scrapeSaved}
                    onClick={() => saveDiscoveredGrant({
                      name: scrapeResult.name!,
                      funder_name: scrapeResult.funder_name,
                      amount_requested: scrapeResult.amount_value,
                      application_due_at: parseDeadline(scrapeResult.deadline),
                      notes: [scrapeResult.description, scrapeResult.eligibility].filter(Boolean).join('\n\n'),
                      source_url: scrapeSourceUrl,
                    })}
                  >
                    {scrapeSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    {scrapeSaved ? 'Saved' : 'Save to Discovered Grants'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
