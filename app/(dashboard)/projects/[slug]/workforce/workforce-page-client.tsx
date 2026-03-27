'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContractorsPageClient } from '../contractors/contractors-page-client';
import { EmployeesPageClient } from '@/components/community/employees/employees-page-client';
import { JobsPageClient } from '../jobs/jobs-page-client';
import { TimesheetsPageClient } from '@/components/community/timesheets/timesheets-page-client';

export function WorkforcePageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') || 'contractors';
  const [activeTab, setActiveTab] = useState(initialTab);

  function handleTabChange(value: string) {
    setActiveTab(value);
    const url = new URL(window.location.href);
    if (value === 'contractors') {
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
          <TabsTrigger value="contractors">Contractors</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
        </TabsList>

        <TabsContent value="contractors">
          <ContractorsPageClient />
        </TabsContent>
        <TabsContent value="employees">
          <EmployeesPageClient />
        </TabsContent>
        <TabsContent value="jobs">
          <JobsPageClient />
        </TabsContent>
        <TabsContent value="timesheets">
          <TimesheetsPageClient />
        </TabsContent>
      </Tabs>
    </div>
  );
}
