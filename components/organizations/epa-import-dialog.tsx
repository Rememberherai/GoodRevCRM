'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2,
  Search,
  Check,
  AlertCircle,
  Droplets,
  Download,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface EPAImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

interface EPAFacility {
  permit_id: string;
  name: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  street: string | null;
  county: string | null;
  design_flow_mgd: number | null;
  actual_flow_mgd: number | null;
  facility_type: string | null;
  latitude: number | null;
  longitude: number | null;
}

type DialogStep = 'configure' | 'searching' | 'preview' | 'importing' | 'complete';

const US_STATES = [
  { value: '', label: 'All States' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

export function EPAImportDialog({
  open,
  onOpenChange,
  onComplete,
}: EPAImportDialogProps) {
  const params = useParams();
  const slug = params.slug as string;

  const [step, setStep] = useState<DialogStep>('configure');
  const [state, setState] = useState('');
  const [minDesignFlow, setMinDesignFlow] = useState('');
  const [maxResults, setMaxResults] = useState('250');
  const [sortBy, setSortBy] = useState<'design_flow' | 'name' | 'city'>('design_flow');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [facilities, setFacilities] = useState<EPAFacility[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ created: number; failed: number } | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('configure');
      setState('');
      setMinDesignFlow('');
      setMaxResults('250');
      setSortBy('design_flow');
      setSortOrder('desc');
      setFacilities([]);
      setSelectedIds(new Set());
      setError(null);
      setImportProgress(0);
      setImportResult(null);
    }
  }, [open]);

  const handleSearch = async () => {
    setError(null);
    setStep('searching');

    try {
      const searchParams = new URLSearchParams();
      if (state) searchParams.set('state', state);
      if (minDesignFlow) searchParams.set('min_design_flow', minDesignFlow);
      searchParams.set('max_results', maxResults);
      searchParams.set('sort_by', sortBy);
      searchParams.set('sort_order', sortOrder);

      const response = await fetch(
        `/api/projects/${slug}/epa-import?${searchParams.toString()}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to fetch EPA data');
      }

      setFacilities(data.facilities ?? []);

      // Auto-select top 50 facilities by default
      const autoSelect = new Set<string>(
        (data.facilities ?? [])
          .slice(0, 50)
          .map((f: EPAFacility) => f.permit_id)
      );
      setSelectedIds(autoSelect);

      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setStep('configure');
    }
  };

  const handleImport = async () => {
    const selectedFacilities = facilities.filter((f) => selectedIds.has(f.permit_id));
    if (selectedFacilities.length === 0) {
      setError('Please select at least one facility');
      return;
    }

    setError(null);
    setStep('importing');
    setImportProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const response = await fetch(`/api/projects/${slug}/epa-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilities: selectedFacilities }),
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Import failed');
      }

      setImportResult({
        created: data.created_count ?? 0,
        failed: selectedFacilities.length - (data.created_count ?? 0),
      });
      setStep('complete');
      toast.success(`Imported ${data.created_count} POTW facilities`);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  };

  const toggleFacility = (permitId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(permitId)) {
      newSelected.delete(permitId);
    } else {
      newSelected.add(permitId);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => setSelectedIds(new Set(facilities.map((f) => f.permit_id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleClose = () => {
    if (step === 'searching' || step === 'importing') return; // Prevent close during async
    onOpenChange(false);
  };

  const formatFlow = (mgd: number | null) => {
    if (mgd === null || mgd === undefined) return '—';
    if (mgd >= 1) return `${mgd.toFixed(1)} MGD`;
    if (mgd >= 0.001) return `${(mgd * 1000).toFixed(0)} GPD`;
    return `${mgd.toFixed(4)} MGD`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-500" />
            Import EPA POTW Facilities
          </DialogTitle>
          <DialogDescription>
            {step === 'configure' &&
              'Configure filters to search the EPA ECHO database for wastewater treatment plants.'}
            {step === 'searching' && 'Searching EPA database...'}
            {step === 'preview' &&
              `Found ${facilities.length} facilities. Select which to import.`}
            {step === 'importing' && 'Importing facilities...'}
            {step === 'complete' && 'Import complete!'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Configure */}
        {step === 'configure' && (
          <div className="space-y-4 py-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>State Filter</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger>
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s.value || 'all'} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Min Design Flow (MGD)</Label>
                <Input
                  type="number"
                  value={minDesignFlow}
                  onChange={(e) => setMinDesignFlow(e.target.value)}
                  placeholder="e.g., 1.0"
                  step="0.1"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Max Results</Label>
                <Select value={maxResults} onValueChange={setMaxResults}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="250">250</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sort By</Label>
                <Select
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v as typeof sortBy)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="design_flow">Design Flow</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="city">City</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Order</Label>
                <Select
                  value={sortOrder}
                  onValueChange={(v) => setSortOrder(v as typeof sortOrder)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Highest First</SelectItem>
                    <SelectItem value="asc">Lowest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">About EPA POTW Data</p>
              <p className="mt-1">
                Data is sourced from EPA ECHO (Enforcement and Compliance History
                Online) Clean Water Act facility database. Only POTW (Publicly Owned
                Treatment Works) facilities are included.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Searching */}
        {step === 'searching' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="mt-4 text-muted-foreground">
              Searching EPA ECHO database...
            </p>
            <p className="text-sm text-muted-foreground">This may take a moment</p>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <div className="space-y-4 py-2">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {facilities.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Building2 className="mx-auto h-8 w-8 mb-2" />
                <p>No facilities found matching your criteria.</p>
                <p className="text-sm mt-1">Try adjusting your filters.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} of {facilities.length} selected
                  </span>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[350px] rounded-md border">
                  <div className="p-2 space-y-1">
                    {facilities.map((facility) => (
                      <div
                        key={facility.permit_id}
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          selectedIds.has(facility.permit_id)
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleFacility(facility.permit_id)}
                      >
                        <Checkbox
                          checked={selectedIds.has(facility.permit_id)}
                          onCheckedChange={() => toggleFacility(facility.permit_id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {facility.name}
                            </span>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {formatFlow(facility.design_flow_mgd)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span>
                              {facility.city}, {facility.state} {facility.zip}
                            </span>
                            <span className="text-xs">•</span>
                            <span className="text-xs font-mono">
                              {facility.permit_id}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        )}

        {/* Step 4: Importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-muted-foreground">
              Importing {selectedIds.size} facilities...
            </p>
            <Progress value={importProgress} className="w-64" />
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && importResult && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-green-100 p-3">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <p className="mt-4 font-medium">
              Imported {importResult.created} facilities
            </p>
            {importResult.failed > 0 && (
              <p className="text-sm text-muted-foreground">
                {importResult.failed} failed to import
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'configure' && (
            <>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSearch}>
                <Search className="mr-2 h-4 w-4" />
                Search EPA Database
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('configure')}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={selectedIds.size === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Import {selectedIds.size} Facilities
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button type="button" onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
