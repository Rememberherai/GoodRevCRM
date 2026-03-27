'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { ExternalLink, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContractorsPageClient } from '../contractors/contractors-page-client';
import { EmployeesPageClient } from '@/components/community/employees/employees-page-client';
import { JobsPageClient } from '../jobs/jobs-page-client';
import { TimesheetsPageClient } from '@/components/community/timesheets/timesheets-page-client';
import { usePermissions } from '@/lib/contexts/permissions';

const WORKFORCE_TABS = [
  { value: 'contractors', label: 'Contractors', resource: 'jobs.contractors' },
  { value: 'employees', label: 'Employees', resource: 'jobs.employees' },
  { value: 'jobs', label: 'Jobs', resource: 'jobs.jobs' },
  { value: 'timesheets', label: 'Timesheets', resource: 'jobs.timesheets' },
] as const;

export function WorkforcePageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const { isDenied } = usePermissions();

  const visibleTabs = useMemo(
    () => WORKFORCE_TABS.filter((t) => !isDenied(t.resource)),
    [isDenied]
  );

  const defaultTab = visibleTabs.find((t) => t.value === (searchParams.get('tab') || 'contractors'))?.value
    ?? visibleTabs[0]?.value
    ?? 'contractors';
  const [activeTab, setActiveTab] = useState(defaultTab);

  function handleTabChange(value: string) {
    setActiveTab(value as typeof activeTab);
    const url = new URL(window.location.href);
    if (value === 'contractors') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', value);
    }
    router.replace(url.pathname + url.search, { scroll: false });
  }

  if (visibleTabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldAlert className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">No workforce tabs available</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your current permissions do not grant access to any workforce features.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between">
          <TabsList>
            {visibleTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {activeTab === 'contractors' && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/contractor/${slug}`} target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" />
                Contractor Portal
              </Link>
            </Button>
          )}
        </div>

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
