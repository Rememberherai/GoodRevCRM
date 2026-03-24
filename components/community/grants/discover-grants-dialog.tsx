'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ExternalLink, Globe, Loader2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

interface DiscoverGrantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
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

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(dateStr + 'T00:00:00') : new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function DiscoverGrantsDialog({ open, onOpenChange, onImported }: DiscoverGrantsDialogProps) {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('__all__');
  const [eligibility, setEligibility] = useState('__all__');
  const [results, setResults] = useState<GrantsGovOpportunity[]>([]);
  const [hitCount, setHitCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ q: keyword.trim() });
      if (category && category !== '__all__') params.set('fundingCategories', category);
      if (eligibility && eligibility !== '__all__') params.set('eligibilities', eligibility);

      const res = await fetch(`/api/projects/${slug}/grants/discover?${params}`);
      const json = await res.json() as { opportunities?: GrantsGovOpportunity[]; hitCount?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Search failed');
      setResults(json.opportunities ?? []);
      setHitCount(json.hitCount ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleImport = async (opp: GrantsGovOpportunity) => {
    setImportingId(opp.id);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/grants/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity: opp }),
      });
      const json = await res.json() as { grant?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Import failed');

      onImported();
      onOpenChange(false);
      if (json.grant?.id) {
        router.push(`/projects/${slug}/grants/${json.grant.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setError(null);
        setResults([]);
        setHasSearched(false);
        setKeyword('');
        setCategory('__all__');
        setEligibility('__all__');
        setHitCount(0);
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Discover Federal Grants
          </DialogTitle>
          <DialogDescription>
            Search Grants.gov for federal funding opportunities and import them into your pipeline.
          </DialogDescription>
        </DialogHeader>

        {/* Search Form */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search keywords (e.g. community development, youth services)"
                onKeyDown={(e) => e.key === 'Enter' && !isSearching && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching || !keyword.trim()}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  {FUNDING_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Eligibility</Label>
              <Select value={eligibility} onValueChange={setEligibility}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All Eligibility" /></SelectTrigger>
                <SelectContent>
                  {ELIGIBILITY_TYPES.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {hasSearched && !isSearching && results.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No opportunities found. Try different keywords or broader filters.
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{hitCount.toLocaleString()} results found</p>
              {results.map((opp) => (
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
                      Opens {formatDate(opp.openDate)} · Closes {formatDate(opp.closeDate)}
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
                        onClick={() => handleImport(opp)}
                        disabled={!!importingId}
                      >
                        {importingId === opp.id ? 'Importing...' : 'Import'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
