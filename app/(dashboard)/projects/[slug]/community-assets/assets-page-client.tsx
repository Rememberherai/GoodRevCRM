'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NewAssetDialog } from '@/components/community/assets/new-asset-dialog';
import { AssetAccessQueue } from '@/components/community/assets/asset-access-queue';

interface AssetRecord {
  id: string;
  name: string;
  category: string;
  condition: string;
  address_city: string | null;
  address_state: string | null;
  value_estimate: number | null;
}

export function AssetsPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/community-assets?limit=100`);
      const data = await response.json() as { assets?: AssetRecord[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load assets');
      }
      setAssets(data.assets ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load assets');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Community Assets</h2>
            <p className="text-sm text-muted-foreground">Facilities, land, equipment, and other shared community resources.</p>
          </div>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Asset
        </Button>
      </div>

      <Tabs defaultValue="assets">
        <TabsList>
          <TabsTrigger value="assets">All Assets</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="active">Active Access</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Asset Directory</CardTitle>
              <CardDescription>Track condition, location, stewards, and estimated value.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              )}
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
                ))
              ) : assets.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                  No community assets yet.
                </div>
              ) : assets.map((asset) => (
                <Link key={asset.id} href={`/projects/${slug}/community-assets/${asset.id}`} className="block rounded-lg border p-4 transition-colors hover:bg-accent">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="font-medium">{asset.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {[asset.address_city, asset.address_state].filter(Boolean).join(', ') || 'No location yet'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{asset.category}</Badge>
                      <Badge variant="outline">{asset.condition}</Badge>
                      {asset.value_estimate !== null && <Badge variant="outline">${asset.value_estimate.toFixed(2)}</Badge>}
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="pt-4">
          <AssetAccessQueue initialFilter="pending" />
        </TabsContent>

        <TabsContent value="active" className="pt-4">
          <AssetAccessQueue initialFilter="confirmed" />
        </TabsContent>

        <TabsContent value="overdue" className="pt-4">
          <AssetAccessQueue initialFilter="overdue" />
        </TabsContent>
      </Tabs>

      <NewAssetDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} onCreated={() => void loadAssets()} />
    </div>
  );
}
