'use client';

import type { Database } from '@/types/database';

type AccountingCompany = Database['public']['Tables']['accounting_companies']['Row'];

interface AccountingOverviewProps {
  company: AccountingCompany;
}

export function AccountingOverview({ company }: AccountingOverviewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accounting Overview</h1>
        <p className="text-muted-foreground mt-1">
          {company.name} &middot; {company.base_currency}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Cash Balance</p>
          <p className="text-2xl font-bold mt-1">--</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Accounts Receivable</p>
          <p className="text-2xl font-bold mt-1">--</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Accounts Payable</p>
          <p className="text-2xl font-bold mt-1">--</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Net Income (MTD)</p>
          <p className="text-2xl font-bold mt-1">--</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Financial data will populate as you add journal entries, invoices, and bills.
      </p>
    </div>
  );
}
