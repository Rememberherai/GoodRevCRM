'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Map as MapIcon, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CommunityMapData } from '@/lib/community/map';

const DynamicCommunityMap = dynamic(
  () => import('@/components/community/map/community-map').then((module) => module.CommunityMap),
  {
    ssr: false,
  }
);

export function CommunityMapPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<CommunityMapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const loadMap = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${slug}/community/map`);
      const payload = await response.json() as CommunityMapData & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to load community map');
      }
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load community map');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadMap();
  }, [loadMap]);

  const runGeocoding = useCallback(async () => {
    setIsGeocoding(true);
    try {
      const response = await fetch(`/api/projects/${slug}/community/geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 20 }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to geocode community records');
      }
      await loadMap();
    } catch (geocodeError) {
      setError(geocodeError instanceof Error ? geocodeError.message : 'Failed to geocode pending records');
    } finally {
      setIsGeocoding(false);
    }
  }, [loadMap, slug]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MapIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Community Map</h2>
            <p className="text-sm text-muted-foreground">
              View households, assets, programs, and partner organizations across the service area.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void runGeocoding()} disabled={isGeocoding}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          {isGeocoding ? 'Geocoding…' : 'Process Pending Geocodes'}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="rounded-xl border p-10 text-sm text-muted-foreground">Loading map…</div>
      )}

      {!isLoading && data && (
        <DynamicCommunityMap slug={slug} data={data} />
      )}
    </div>
  );
}
