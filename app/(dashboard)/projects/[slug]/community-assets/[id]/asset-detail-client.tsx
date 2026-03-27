'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Building2, MapPin, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssetCalendar } from '@/components/community/assets/asset-calendar';
import { AccessSettingsTab } from '@/components/community/assets/access-settings-tab';
import { ApprovedPeopleTab } from '@/components/community/assets/approved-people-tab';
import { AssetRequestsTab } from '@/components/community/assets/asset-requests-tab';
import { EditAssetDialog } from '@/components/community/assets/edit-asset-dialog';

interface AssetDetail {
  id: string;
  name: string;
  description: string | null;
  category: string;
  condition: string;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  notes: string | null;
  value_estimate: number | null;
  dimension_id: string | null;
  steward_person_id: string | null;
  steward_organization_id: string | null;
  steward_person?: { first_name: string | null; last_name: string | null; email: string | null } | null;
  steward_organization?: { name: string } | null;
  dimension?: { label: string; color: string | null } | null;
}

export function AssetDetailClient({ assetId }: { assetId: string }) {
  const params = useParams();
  const slug = params.slug as string;
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const loadAsset = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/community-assets/${assetId}`);
      const data = await response.json() as { asset?: AssetDetail; error?: string };
      if (!response.ok || !data.asset) {
        throw new Error(data.error ?? 'Failed to load asset');
      }
      setAsset(data.asset);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load asset');
    } finally {
      setIsLoading(false);
    }
  }, [assetId, slug]);

  useEffect(() => {
    void loadAsset();
  }, [loadAsset]);

  if (isLoading) {
    return <div className="h-72 animate-pulse rounded-xl bg-muted" />;
  }

  if (error || !asset) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="px-0">
          <Link href={`/projects/${slug}/community-assets`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Community Assets
          </Link>
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? 'Asset not found'}
        </div>
      </div>
    );
  }

  const stewardName = [asset.steward_person?.first_name, asset.steward_person?.last_name].filter(Boolean).join(' ');
  const address = [asset.address_street, asset.address_city, asset.address_state].filter(Boolean).join(', ');

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="px-0">
        <Link href={`/projects/${slug}/community-assets`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Community Assets
        </Link>
      </Button>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">{asset.name}</h2>
              <div className="text-sm text-muted-foreground">{address || 'No address recorded'}</div>
            </div>
          </div>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{asset.category}</Badge>
          <Badge variant="outline">{asset.condition}</Badge>
          {asset.dimension?.label && <Badge variant="outline">{asset.dimension.label}</Badge>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Location</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{address || 'No address recorded'}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Steward</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {stewardName || asset.steward_organization?.name || 'No steward assigned'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Estimated Value</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {asset.value_estimate !== null ? `$${asset.value_estimate.toFixed(2)}` : 'No value estimate yet'}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="approved">Approved People</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Asset Details</CardTitle>
              <CardDescription>Description, notes, and supporting context.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">{asset.description || 'No description provided.'}</div>
              {asset.notes && (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  {asset.notes}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="pt-4">
          <AssetCalendar assetId={asset.id} />
        </TabsContent>

        <TabsContent value="access" className="pt-4">
          <AccessSettingsTab assetId={asset.id} />
        </TabsContent>

        <TabsContent value="requests" className="pt-4">
          <AssetRequestsTab assetId={asset.id} />
        </TabsContent>

        <TabsContent value="approved" className="pt-4">
          <ApprovedPeopleTab assetId={asset.id} />
        </TabsContent>
      </Tabs>

      <EditAssetDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        asset={asset}
        onUpdated={() => void loadAsset()}
      />
    </div>
  );
}
