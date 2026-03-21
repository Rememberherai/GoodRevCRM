'use client';

import { AccountingSidebar } from '@/components/layout/accounting-sidebar';
import { AccountingHeader } from '@/components/layout/accounting-header';
import { MobileSidebar } from '@/components/layout/mobile-sidebar';
import type { Database } from '@/types/database';

type AccountingCompany = Database['public']['Tables']['accounting_companies']['Row'];

interface AccountingShellProps {
  company: AccountingCompany | null;
  companyId: string | null;
  children: React.ReactNode;
}

export function AccountingShell({ company, companyId, children }: AccountingShellProps) {
  // If no company exists, show onboarding (the page.tsx handles this)
  if (!company || !companyId) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex flex-col flex-1 overflow-hidden">
          <AccountingHeader />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <AccountingSidebar companyName={company.name} />
      <MobileSidebar>
        <AccountingSidebar companyName={company.name} className="flex w-full border-r-0" />
      </MobileSidebar>
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <AccountingHeader />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
