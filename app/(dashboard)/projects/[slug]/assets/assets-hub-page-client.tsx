'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssetsPageClient } from '../community-assets/assets-page-client';
import { CommunityMapPageClient } from '../community-map/community-map-page-client';

export function AssetsHubPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') || 'assets';
  const [activeTab, setActiveTab] = useState(initialTab);

  function handleTabChange(value: string) {
    setActiveTab(value);
    const url = new URL(window.location.href);
    if (value === 'assets') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', value);
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
        </TabsList>

        <TabsContent value="assets">
          <AssetsPageClient />
        </TabsContent>
        <TabsContent value="map">
          <CommunityMapPageClient />
        </TabsContent>
      </Tabs>
    </div>
  );
}
