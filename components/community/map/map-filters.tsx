'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface CommunityMapLayerState {
  households: boolean;
  assets: boolean;
  programs: boolean;
  organizations: boolean;
}

export interface CommunityMapFilterState {
  assetCategory: string;
  assetCondition: string;
  programStatus: string;
}

interface MapFiltersProps {
  layers: CommunityMapLayerState;
  filters: CommunityMapFilterState;
  onLayerToggle: (layer: keyof CommunityMapLayerState) => void;
  onFilterChange: (filter: keyof CommunityMapFilterState, value: string) => void;
  onReset: () => void;
}

export function MapFilters({
  layers,
  filters,
  onLayerToggle,
  onFilterChange,
  onReset,
}: MapFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Map Filters</CardTitle>
        <CardDescription>Toggle layers and narrow the visible markers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="text-sm font-medium">Layers</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(layers) as Array<keyof CommunityMapLayerState>).map((layer) => (
              <label key={layer} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={layers[layer]}
                  onChange={() => onLayerToggle(layer)}
                />
                <span className="capitalize">{layer}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Asset Category</span>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={filters.assetCategory}
              onChange={(event) => onFilterChange('assetCategory', event.target.value)}
            >
              <option value="">All categories</option>
              <option value="facility">Facility</option>
              <option value="land">Land</option>
              <option value="equipment">Equipment</option>
              <option value="vehicle">Vehicle</option>
              <option value="technology">Technology</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Asset Condition</span>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={filters.assetCondition}
              onChange={(event) => onFilterChange('assetCondition', event.target.value)}
            >
              <option value="">All conditions</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Program Status</span>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={filters.programStatus}
              onChange={(event) => onFilterChange('programStatus', event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="text-sm font-medium text-primary hover:underline"
        >
          Reset filters
        </button>
      </CardContent>
    </Card>
  );
}
