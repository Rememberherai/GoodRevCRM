'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { HouseholdCountResult } from '@/lib/enrichment/census-households';

interface ServiceAreaSettings {
  service_area_type: 'municipality' | 'zip_codes';
  service_area_municipalities: Array<{ city: string; state: string }>;
  service_area_zip_codes: string[];
  census_total_households: number | null;
  household_denominator_override: number | null;
  census_total_population: number | null;
  community_population_denominator: number | null;
}

const EMPTY_SETTINGS: ServiceAreaSettings = {
  service_area_type: 'municipality',
  service_area_municipalities: [],
  service_area_zip_codes: [],
  census_total_households: null,
  household_denominator_override: null,
  census_total_population: null,
  community_population_denominator: null,
};

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export function ServiceAreaPanel({ slug }: { slug: string }) {
  const [settings, setSettings] = useState<ServiceAreaSettings>(EMPTY_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [censusResults, setCensusResults] = useState<HouseholdCountResult[]>([]);

  // New entry fields
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newZip, setNewZip] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}`);
      if (!res.ok) return;
      const data = await res.json();
      const projectSettings = data.project?.settings || {};
      setSettings({
        service_area_type: projectSettings.service_area_type || 'municipality',
        service_area_municipalities: projectSettings.service_area_municipalities || [],
        service_area_zip_codes: projectSettings.service_area_zip_codes || [],
        census_total_households: projectSettings.census_total_households ?? null,
        household_denominator_override: projectSettings.household_denominator_override ?? null,
        census_total_population: projectSettings.census_total_population ?? null,
        community_population_denominator: projectSettings.community_population_denominator ?? null,
      });
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async (updated: ServiceAreaSettings, { silent = false } = {}) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updated }),
      });
      if (!res.ok) {
        throw new Error('Failed to save settings');
      }
      setSettings(updated);
      if (!silent) {
        toast.success('Service area settings saved');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchCensusData = async () => {
    setIsFetching(true);
    setCensusResults([]);
    try {
      const body =
        settings.service_area_type === 'municipality'
          ? { type: 'municipality', municipalities: settings.service_area_municipalities }
          : { type: 'zip_codes', zipCodes: settings.service_area_zip_codes };

      const res = await fetch(`/api/projects/${slug}/census-households`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Census lookup failed');
      }

      const data = await res.json() as { results: HouseholdCountResult[]; total: number; totalPopulation: number };
      setCensusResults(data.results);

      // Determine if population denominator was manually overridden (differs from old census value)
      const hasManualPopOverride =
        settings.community_population_denominator !== null &&
        settings.community_population_denominator !== settings.census_total_population;

      // Auto-save entries, type, and census totals (silent — we show our own toast below)
      const updated = {
        ...settings,
        census_total_households: data.total,
        census_total_population: data.totalPopulation,
        // Update population denominator from census unless user has a manual override
        community_population_denominator: hasManualPopOverride
          ? settings.community_population_denominator
          : data.totalPopulation,
      };
      await saveSettings(updated, { silent: true });

      toast.success(`Found ${data.total.toLocaleString()} households and ${data.totalPopulation.toLocaleString()} people across ${data.results.length} area(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Census lookup failed');
    } finally {
      setIsFetching(false);
    }
  };

  const addMunicipality = () => {
    if (!newCity.trim() || !newState) return;
    const updated = {
      ...settings,
      service_area_municipalities: [
        ...settings.service_area_municipalities,
        { city: newCity.trim(), state: newState },
      ],
    };
    setSettings(updated);
    setNewCity('');
    setNewState('');
  };

  const removeMunicipality = (index: number) => {
    const updated = {
      ...settings,
      service_area_municipalities: settings.service_area_municipalities.filter((_, i) => i !== index),
    };
    setSettings(updated);
  };

  const addZipCode = () => {
    const zip = newZip.trim();
    if (!zip || !/^\d{5}$/.test(zip)) {
      toast.error('Enter a valid 5-digit ZIP code');
      return;
    }
    if (settings.service_area_zip_codes.includes(zip)) {
      toast.error('ZIP code already added');
      return;
    }
    const updated = {
      ...settings,
      service_area_zip_codes: [...settings.service_area_zip_codes, zip],
    };
    setSettings(updated);
    setNewZip('');
  };

  const removeZipCode = (index: number) => {
    const updated = {
      ...settings,
      service_area_zip_codes: settings.service_area_zip_codes.filter((_, i) => i !== index),
    };
    setSettings(updated);
  };

  const effectiveHouseholdDenominator = settings.household_denominator_override ?? settings.census_total_households;
  const effectivePopulationDenominator = settings.community_population_denominator ?? settings.census_total_population;
  const hasEntries =
    settings.service_area_type === 'municipality'
      ? settings.service_area_municipalities.length > 0
      : settings.service_area_zip_codes.length > 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Service Area</CardTitle>
          <CardDescription>
            Define your community&apos;s service area to calculate impact percentages.
            Population and household totals are fetched from the US Census Bureau (ACS 5-year estimates).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Area type toggle */}
          <div className="space-y-2">
            <Label>Define service area by</Label>
            <Select
              value={settings.service_area_type}
              onValueChange={(value: 'municipality' | 'zip_codes') => {
                setSettings({ ...settings, service_area_type: value });
              }}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="municipality">Municipality (City + State)</SelectItem>
                <SelectItem value="zip_codes">ZIP Codes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Municipality entries */}
          {settings.service_area_type === 'municipality' && (
            <div className="space-y-3">
              {settings.service_area_municipalities.map((muni, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1 rounded-md border px-3 py-2 text-sm">
                    {muni.city}, {muni.state}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMunicipality(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">City</Label>
                  <Input
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    placeholder="e.g. Springfield"
                    onKeyDown={(e) => e.key === 'Enter' && addMunicipality()}
                  />
                </div>
                <div className="w-[100px] space-y-1">
                  <Label className="text-xs">State</Label>
                  <Select value={newState} onValueChange={setNewState}>
                    <SelectTrigger>
                      <SelectValue placeholder="ST" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((st) => (
                        <SelectItem key={st} value={st}>{st}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="icon" onClick={addMunicipality} disabled={!newCity.trim() || !newState}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ZIP code entries */}
          {settings.service_area_type === 'zip_codes' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {settings.service_area_zip_codes.map((zip, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
                  >
                    {zip}
                    <button
                      onClick={() => removeZipCode(index)}
                      className="ml-1 text-muted-foreground hover:text-foreground"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <div className="w-[140px] space-y-1">
                  <Label className="text-xs">ZIP Code</Label>
                  <Input
                    value={newZip}
                    onChange={(e) => setNewZip(e.target.value)}
                    placeholder="90210"
                    maxLength={5}
                    onKeyDown={(e) => e.key === 'Enter' && addZipCode()}
                  />
                </div>
                <Button variant="outline" size="icon" onClick={addZipCode} disabled={!newZip.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Fetch + Save buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={fetchCensusData} disabled={isFetching || !hasEntries}>
              {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Fetch from Census
            </Button>
            <Button variant="outline" onClick={() => saveSettings(settings)} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
          </div>

          {/* Census results */}
          {censusResults.length > 0 && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="text-sm font-medium">Census Results</div>
              {censusResults.map((r, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{r.name}</span>
                  <span>{r.population.toLocaleString()} people &middot; {r.households.toLocaleString()} households</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-medium border-t pt-2">
                <span>Total</span>
                <span>
                  {censusResults.reduce((s, r) => s + r.population, 0).toLocaleString()} people &middot;{' '}
                  {censusResults.reduce((s, r) => s + r.households, 0).toLocaleString()} households
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Denominators card */}
      <Card>
        <CardHeader>
          <CardTitle>Impact Denominators</CardTitle>
          <CardDescription>
            Census values used to calculate household and population impact percentages.
            Override with more accurate data if available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Households */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Households</Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Census Value</Label>
                <div className="text-lg font-medium">
                  {settings.census_total_households !== null
                    ? settings.census_total_households.toLocaleString()
                    : 'Not fetched'}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Manual Override</Label>
                <Input
                  type="number"
                  value={settings.household_denominator_override ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setSettings({ ...settings, household_denominator_override: val });
                  }}
                  placeholder="Leave empty to use census value"
                />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Effective: <span className="font-medium text-foreground">
                {effectiveHouseholdDenominator !== null ? effectiveHouseholdDenominator.toLocaleString() : 'Not set'}
              </span>
            </div>
          </div>

          <div className="border-t" />

          {/* Population */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Population</Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Census Value</Label>
                <div className="text-lg font-medium">
                  {settings.census_total_population !== null
                    ? settings.census_total_population.toLocaleString()
                    : 'Not fetched'}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Manual Override</Label>
                <Input
                  type="number"
                  value={settings.community_population_denominator ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setSettings({ ...settings, community_population_denominator: val });
                  }}
                  placeholder="Leave empty to use census value"
                />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Effective: <span className="font-medium text-foreground">
                {effectivePopulationDenominator !== null ? effectivePopulationDenominator.toLocaleString() : 'Not set'}
              </span>
            </div>
          </div>

          <Button variant="outline" onClick={() => saveSettings(settings)} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
