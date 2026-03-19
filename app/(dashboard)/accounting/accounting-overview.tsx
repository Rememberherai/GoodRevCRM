'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Database } from '@/types/database';

type AccountingCompany = Database['public']['Tables']['accounting_companies']['Row'];

interface AccountingOverviewProps {
  company: AccountingCompany;
}

interface OverviewData {
  cashBalance: number | null;
  arBalance: number | null;
  apBalance: number | null;
  netIncome: number | null;
}

interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  account_subtype?: string | null;
  balance: number;
}

function fmt(n: number | null, currency: string): string {
  if (n === null) return '--';
  return n.toLocaleString('en-US', { style: 'currency', currency });
}
function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function AccountingOverview({ company }: AccountingOverviewProps) {
  const [data, setData] = useState<OverviewData>({
    cashBalance: null,
    arBalance: null,
    apBalance: null,
    netIncome: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOverview() {
      try {
        const today = new Date();
        const yearStart = `${today.getFullYear()}-01-01`;
        const todayStr = todayDateString();

        const [tbRes, plRes, arRes, apRes] = await Promise.all([
          fetch(`/api/accounting/trial-balance?as_of_date=${todayStr}`),
          fetch(`/api/accounting/reports/profit-loss?start_date=${yearStart}&end_date=${todayStr}`),
          fetch(`/api/accounting/reports/ar-aging?as_of_date=${todayStr}`),
          fetch(`/api/accounting/reports/ap-aging?as_of_date=${todayStr}`),
        ]);

        let cashBalance: number | null = null;
        if (tbRes.ok) {
          cashBalance = 0;
          const tb = await tbRes.json();
          const rows = (tb.data ?? []) as TrialBalanceRow[];
          for (const row of rows) {
            if (
              row.account_type === 'asset' &&
              (
                row.account_subtype === 'cash' ||
                row.account_subtype === 'bank'
              )
            ) {
              cashBalance += row.balance;
            }
          }
        }

        let netIncome: number | null = null;
        if (plRes.ok) {
          const pl = await plRes.json();
          netIncome = pl.data?.net_income ?? 0;
        }

        let arBalance: number | null = null;
        if (arRes.ok) {
          const ar = await arRes.json();
          arBalance = ar.data?.total_outstanding ?? 0;
        }

        let apBalance: number | null = null;
        if (apRes.ok) {
          const ap = await apRes.json();
          apBalance = ap.data?.total_outstanding ?? 0;
        }

        setData({ cashBalance, arBalance, apBalance, netIncome });
      } catch (err) {
        console.error('Failed to load overview data:', err);
        setData({
          cashBalance: null,
          arBalance: null,
          apBalance: null,
          netIncome: null,
        });
      } finally {
        setLoading(false);
      }
    }
    loadOverview();
  }, []);

  const cards = [
    {
      label: 'Cash Balance',
      value: data.cashBalance,
      href: '/accounting/reports/trial-balance',
    },
    {
      label: 'Accounts Receivable',
      value: data.arBalance,
      href: '/accounting/reports/ar-aging',
    },
    {
      label: 'Accounts Payable',
      value: data.apBalance,
      href: '/accounting/reports/ap-aging',
    },
    {
      label: 'Net Income (YTD)',
      value: data.netIncome,
      href: '/accounting/reports/profit-loss',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accounting Overview</h1>
        <p className="text-muted-foreground mt-1">
          {company.name} &middot; {company.base_currency}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-lg border bg-card p-6 hover:bg-accent/50 transition-colors group"
          >
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${loading ? 'animate-pulse' : ''}`}>
              {loading ? (
                <span className="inline-block h-8 w-24 bg-muted rounded" />
              ) : (
                fmt(card.value, company.base_currency)
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 group-hover:text-primary">
              View report <ArrowRight className="h-3 w-3" />
            </p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/accounting/reports"
          className="rounded-lg border bg-card p-5 hover:bg-accent/50 transition-colors"
        >
          <h3 className="font-semibold">Financial Reports</h3>
          <p className="text-sm text-muted-foreground mt-1">
            P&L, Balance Sheet, Cash Flow, General Ledger, Aging Reports
          </p>
        </Link>
        <Link
          href="/accounting/journal-entries"
          className="rounded-lg border bg-card p-5 hover:bg-accent/50 transition-colors"
        >
          <h3 className="font-semibold">Journal Entries</h3>
          <p className="text-sm text-muted-foreground mt-1">
            View and create manual journal entries
          </p>
        </Link>
      </div>
    </div>
  );
}
