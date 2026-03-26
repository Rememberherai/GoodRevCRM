'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Search, Globe, Link2, Loader2, ExternalLink, Plus, AlertCircle, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface GrantsGovOpportunity {
  id: string;
  number: string;
  title: string;
  agencyCode: string;
  agencyName?: string;
  openDate: string;
  closeDate: string;
  oppStatus: string;
}

const FUNDING_CATEGORIES = [
  { value: '__all__', label: 'All Categories' },
  { value: 'AG', label: 'Agriculture' },
  { value: 'AR', label: 'Arts' },
  { value: 'BC', label: 'Business & Commerce' },
  { value: 'CD', label: 'Community Development' },
  { value: 'CP', label: 'Consumer Protection' },
  { value: 'DPR', label: 'Disaster Prevention & Relief' },
  { value: 'ED', label: 'Education' },
  { value: 'ELT', label: 'Employment, Labor & Training' },
  { value: 'EN', label: 'Energy' },
  { value: 'ENV', label: 'Environment' },
  { value: 'FN', label: 'Food & Nutrition' },
  { value: 'HL', label: 'Health' },
  { value: 'HO', label: 'Housing' },
  { value: 'HU', label: 'Humanities' },
  { value: 'ISS', label: 'Income Security & Social Services' },
  { value: 'IS', label: 'Information & Statistics' },
  { value: 'LJL', label: 'Law, Justice & Legal Services' },
  { value: 'NR', label: 'Natural Resources' },
  { value: 'RA', label: 'Regional Development' },
  { value: 'ST', label: 'Science & Technology' },
  { value: 'T', label: 'Transportation' },
  { value: 'O', label: 'Other' },
];

const ELIGIBILITY_TYPES = [
  { value: '__all__', label: 'All Eligibility' },
  { value: '25', label: 'Nonprofits 501(c)(3)' },
  { value: '21', label: 'Nonprofits (other)' },
  { value: '00', label: 'State Governments' },
  { value: '01', label: 'County Governments' },
  { value: '02', label: 'City/Township Governments' },
  { value: '06', label: 'Native American Tribes' },
  { value: '12', label: 'Independent School Districts' },
  { value: '20', label: 'Private Higher Ed' },
  { value: '99', label: 'Unrestricted' },
];

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
  category?: string;
  amount?: string;
  amount_value?: number | null;
  funding_range_min?: number | null;
  funding_range_max?: number | null;
  deadline?: string;
  description?: string;
  eligibility?: string;
  focus_areas?: string;
  application_url?: string;
}

function formatFederalDate(dateStr: string | null) {
  if (!dateStr) return '—';
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(dateStr + 'T00:00:00') : new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function GrantDiscoverClient() {
  const { slug } = useParams<{ slug: string }>();
  const [activeTab, setActiveTab] = useState('federal');

  // Federal (Grants.gov) state
  const [federalKeyword, setFederalKeyword] = useState('');
  const [federalCategory, setFederalCategory] = useState('__all__');
  const [federalEligibility, setFederalEligibility] = useState('__all__');
  const [federalResults, setFederalResults] = useState<GrantsGovOpportunity[]>([]);
  const [federalHitCount, setFederalHitCount] = useState(0);
  const [federalSearching, setFederalSearching] = useState(false);
  const [federalImportingId, setFederalImportingId] = useState<string | null>(null);
  const [federalHasSearched, setFederalHasSearched] = useState(false);

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

  const handleFederalSearch = async () => {
    if (!federalKeyword.trim()) return;
    setFederalSearching(true);
    setFederalHasSearched(true);
    try {
      const params = new URLSearchParams({ q: federalKeyword.trim() });
      if (federalCategory !== '__all__') params.set('fundingCategories', federalCategory);
      if (federalEligibility !== '__all__') params.set('eligibilities', federalEligibility);

      const res = await fetch(`/api/projects/${slug}/grants/discover?${params}`);
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Search failed'); }
      const data = await res.json();
      setFederalResults(data.opportunities ?? []);
      setFederalHitCount(data.hitCount ?? 0);
      if ((data.opportunities ?? []).length === 0) {
        toast.info('No federal opportunities found. Try different keywords.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
      setFederalResults([]);
    } finally {
      setFederalSearching(false);
    }
  };

  const handleFederalImport = async (opp: GrantsGovOpportunity) => {
    setFederalImportingId(opp.id);
    try {
      const res = await fetch(`/api/projects/${slug}/grants/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity: opp }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Import failed'); }
      toast.success(`"${opp.title}" imported to discovered grants`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setFederalImportingId(null);
    }
  };

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
    category?: string;
    funding_range_min?: number | null;
    funding_range_max?: number | null;
    application_url?: string;
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
        category: grantData.category,
        amount_requested: grantData.amount_requested,
        funding_range_min: grantData.funding_range_min,
        funding_range_max: grantData.funding_range_max,
        application_due_at: grantData.application_due_at,
        application_url: grantData.application_url,
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
          <TabsTrigger value="federal">
            <Landmark className="mr-2 h-4 w-4" />
            Federal (Grants.gov)
          </TabsTrigger>
          <TabsTrigger value="search">
            <Globe className="mr-2 h-4 w-4" />
            Web Search
          </TabsTrigger>
          <TabsTrigger value="scrape">
            <Link2 className="mr-2 h-4 w-4" />
            URL Scraper
          </TabsTrigger>
        </TabsList>

        {/* Federal Grants.gov Tab */}
        <TabsContent value="federal" className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search keywords (e.g. community development, youth services)"
                value={federalKeyword}
                onChange={e => setFederalKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !federalSearching && handleFederalSearch()}
                disabled={federalSearching}
                className="flex-1"
              />
              <Button onClick={handleFederalSearch} disabled={federalSearching || !federalKeyword.trim()}>
                {federalSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2">Search</span>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={federalCategory} onValueChange={setFederalCategory}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FUNDING_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Eligibility</Label>
                <Select value={federalEligibility} onValueChange={setFederalEligibility}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ELIGIBILITY_TYPES.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {federalSearching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching Grants.gov...
            </div>
          )}

          {federalHasSearched && !federalSearching && federalResults.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No opportunities found. Try different keywords or broader filters.
            </div>
          )}

          {federalResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{federalHitCount.toLocaleString()} results found</p>
              {federalResults.map(opp => (
                <div key={opp.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{opp.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {opp.agencyCode} · {opp.number}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {opp.oppStatus}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Opens {formatFederalDate(opp.openDate)} · Closes {formatFederalDate(opp.closeDate)}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => window.open(`https://www.grants.gov/search-results-detail/${opp.id}`, '_blank')}
                      >
                        <ExternalLink className="mr-1 h-3 w-3" /> View
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleFederalImport(opp)}
                        disabled={!!federalImportingId}
                      >
                        {federalImportingId === opp.id ? 'Importing...' : 'Import'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

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
                      category: scrapeResult.category,
                      amount_requested: scrapeResult.amount_value,
                      funding_range_min: scrapeResult.funding_range_min,
                      funding_range_max: scrapeResult.funding_range_max,
                      application_due_at: parseDeadline(scrapeResult.deadline),
                      application_url: scrapeResult.application_url,
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
