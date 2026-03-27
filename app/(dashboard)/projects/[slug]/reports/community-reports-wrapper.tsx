'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommunityReportsPageClient } from './community-reports-page-client';
import { PublicDashboardSettingsClient } from '../settings/public-dashboard/public-dashboard-settings-client';

export function CommunityReportsWrapper({ projectSlug }: { projectSlug: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('view') || 'reports';
  const [activeTab, setActiveTab] = useState(initialTab);

  function handleTabChange(value: string) {
    setActiveTab(value);
    const url = new URL(window.location.href);
    if (value === 'reports') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', value);
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-6">
        <TabsTrigger value="reports">Reports</TabsTrigger>
        <TabsTrigger value="public-dashboard">Public Dashboard</TabsTrigger>
      </TabsList>

      <TabsContent value="reports">
        <CommunityReportsPageClient projectSlug={projectSlug} />
      </TabsContent>
      <TabsContent value="public-dashboard">
        <PublicDashboardSettingsClient />
      </TabsContent>
    </Tabs>
  );
}
