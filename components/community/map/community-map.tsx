'use client';

import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type CommunityMapData,
  type CommunityAssetMapPoint,
  type HouseholdMapPoint,
  type ProgramMapPoint,
  type OrganizationMapPoint,
} from '@/lib/community/map';
import {
  MapFilters,
  type CommunityMapFilterState,
  type CommunityMapLayerState,
} from './map-filters';
import { HouseholdLayer } from './household-layer';
import { AssetLayer } from './asset-layer';
import { ProgramLayer } from './program-layer';
import { OrgLayer } from './org-layer';

interface CommunityMapProps {
  slug: string;
  data: CommunityMapData;
}

function ZoomWatcher({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  useMapEvents({
    zoomend(event) {
      onZoomChange(event.target.getZoom());
    },
  });

  return null;
}

export function CommunityMap({ slug, data }: CommunityMapProps) {
  const [zoom, setZoom] = useState(data.center.zoom);
  const [layers, setLayers] = useState<CommunityMapLayerState>({
    households: true,
    assets: true,
    programs: true,
    organizations: true,
  });
  const [filters, setFilters] = useState<CommunityMapFilterState>({
    assetCategory: '',
    assetCondition: '',
    programStatus: '',
  });

  const filteredAssets = useMemo(
    () => data.assets.filter((asset: CommunityAssetMapPoint) => (
      (!filters.assetCategory || asset.category === filters.assetCategory)
      && (!filters.assetCondition || asset.condition === filters.assetCondition)
    )),
    [data.assets, filters.assetCategory, filters.assetCondition]
  );

  const filteredPrograms = useMemo(
    () => data.programs.filter((program: ProgramMapPoint) => (
      !filters.programStatus || program.status === filters.programStatus
    )),
    [data.programs, filters.programStatus]
  );

  const filteredHouseholds = data.households as HouseholdMapPoint[];
  const filteredOrganizations = data.organizations as OrganizationMapPoint[];

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <MapFilters
        layers={layers}
        filters={filters}
        onLayerToggle={(layer) => setLayers((current) => ({ ...current, [layer]: !current[layer] }))}
        onFilterChange={(filter, value) => setFilters((current) => ({ ...current, [filter]: value }))}
        onReset={() => {
          setLayers({ households: true, assets: true, programs: true, organizations: true });
          setFilters({ assetCategory: '', assetCondition: '', programStatus: '' });
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Community Map</CardTitle>
          <CardDescription>
            Households, assets, programs, and partner organizations mapped against the service area.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-lg border p-3"><span className="font-medium">{filteredHouseholds.length}</span> households</div>
            <div className="rounded-lg border p-3"><span className="font-medium">{filteredAssets.length}</span> assets</div>
            <div className="rounded-lg border p-3"><span className="font-medium">{filteredPrograms.length}</span> programs</div>
            <div className="rounded-lg border p-3"><span className="font-medium">{filteredOrganizations.length}</span> organizations</div>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <MapContainer
              center={[data.center.latitude, data.center.longitude]}
              zoom={data.center.zoom}
              scrollWheelZoom
              className="h-[68vh] w-full"
            >
              <ZoomWatcher onZoomChange={setZoom} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <HouseholdLayer slug={slug} items={filteredHouseholds} visible={layers.households} zoom={zoom} />
              <AssetLayer slug={slug} items={filteredAssets} visible={layers.assets} zoom={zoom} />
              <ProgramLayer slug={slug} items={filteredPrograms} visible={layers.programs} zoom={zoom} />
              <OrgLayer slug={slug} items={filteredOrganizations} visible={layers.organizations} zoom={zoom} />
            </MapContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
