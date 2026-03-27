'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProgramsPageClient } from '../programs/programs-page-client';
import { ReferralsPageClient } from '../referrals/referrals-page-client';

export function ProgramsServicesPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') || 'programs';
  const [activeTab, setActiveTab] = useState(initialTab);

  function handleTabChange(value: string) {
    setActiveTab(value);
    const url = new URL(window.location.href);
    if (value === 'programs') {
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
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
        </TabsList>

        <TabsContent value="programs">
          <ProgramsPageClient />
        </TabsContent>
        <TabsContent value="referrals">
          <ReferralsPageClient />
        </TabsContent>
      </Tabs>
    </div>
  );
}
