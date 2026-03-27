'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Building2, Filter, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NewAssetDialog } from '@/components/community/assets/new-asset-dialog';
import { AssetAccessQueue } from '@/components/community/assets/asset-access-queue';
import { HubSettingsCard } from '@/components/community/assets/hub-settings-card';

interface AssetRecord {
  id: string;
  name: string;
  category: string;
  condition: string;
  access_mode: string;
  access_enabled: boolean;
  address_city: string | null;
  address_state: string | null;
  value_estimate: number | null;
}

const ACCESS_MODE_STYLES: Record<string, string> = {
  reservable: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
  loanable: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  hybrid: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
  tracked_only: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const ACCESS_MODE_LABELS: Record<string, string> = {
  reservable: 'Reservable',
  loanable: 'Loanable',
  hybrid: 'Hybrid',
  tracked_only: 'Tracked Only',
};

const CATEGORY_OPTIONS = ['facility', 'land', 'equipment', 'vehicle', 'technology', 'other'] as const;
const CONDITION_OPTIONS = ['excellent', 'good', 'fair', 'poor'] as const;

export function AssetsPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [accessFilter, setAccessFilter] = useState('all');

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
          <TabsTrigger value="hub-settings" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Hub Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="pt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filters
            </div>
            <Input
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sm:max-w-[200px]"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="sm:w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORY_OPTIONS.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={conditionFilter} onValueChange={setConditionFilter}>
              <SelectTrigger className="sm:w-[140px]">
                <SelectValue placeholder="Condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Conditions</SelectItem>
                {CONDITION_OPTIONS.map((cond) => (
                  <SelectItem key={cond} value={cond}>{cond.charAt(0).toUpperCase() + cond.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={accessFilter} onValueChange={setAccessFilter}>
              <SelectTrigger className="sm:w-[150px]">
                <SelectValue placeholder="Access" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Access</SelectItem>
                <SelectItem value="enabled">Access Enabled</SelectItem>
                <SelectItem value="disabled">Access Disabled</SelectItem>
                <SelectItem value="reservable">Reservable</SelectItem>
                <SelectItem value="loanable">Loanable</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
              {(() => {
                const filtered = assets.filter((asset) => {
                  if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    if (!asset.name.toLowerCase().includes(q) &&
                        !asset.address_city?.toLowerCase().includes(q) &&
                        !asset.address_state?.toLowerCase().includes(q)) {
                      return false;
                    }
                  }
                  if (categoryFilter !== 'all' && asset.category !== categoryFilter) return false;
                  if (conditionFilter !== 'all' && asset.condition !== conditionFilter) return false;
                  if (accessFilter === 'enabled' && !asset.access_enabled) return false;
                  if (accessFilter === 'disabled' && asset.access_enabled) return false;
                  if (['reservable', 'loanable', 'hybrid'].includes(accessFilter) && asset.access_mode !== accessFilter) return false;
                  return true;
                });

                if (isLoading) {
                  return Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
                  ));
                }

                if (assets.length === 0) {
                  return (
                    <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                      No community assets yet.
                    </div>
                  );
                }

                if (filtered.length === 0) {
                  return (
                    <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                      No assets match your filters.
                    </div>
                  );
                }

                return filtered.map((asset) => (
                  <Link key={asset.id} href={`/projects/${slug}/community-assets/${asset.id}`} className="block rounded-lg border p-4 transition-colors hover:bg-accent">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{asset.name}</span>
                          {asset.access_enabled && (
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="Access enabled" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {[asset.address_city, asset.address_state].filter(Boolean).join(', ') || 'No location yet'}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={ACCESS_MODE_STYLES[asset.access_mode] ?? ''}>
                          {ACCESS_MODE_LABELS[asset.access_mode] ?? asset.access_mode}
                        </Badge>
                        <Badge variant="secondary">{asset.category}</Badge>
                        <Badge variant="outline">{asset.condition}</Badge>
                        {asset.value_estimate !== null && <Badge variant="outline">${asset.value_estimate.toFixed(2)}</Badge>}
                      </div>
                    </div>
                  </Link>
                ));
              })()}
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

        <TabsContent value="hub-settings" className="pt-4">
          <HubSettingsCard />
        </TabsContent>
      </Tabs>

      <NewAssetDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} onCreated={() => void loadAssets()} />
    </div>
  );
}
