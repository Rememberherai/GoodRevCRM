import { createClient } from '@/lib/supabase/server';
import { getAccountingMembershipForUser } from '@/lib/accounting/helpers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  TrendingUp,
  Scale,
  BookOpen,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
} from 'lucide-react';

const reports = [
  {
    title: 'Profit & Loss',
    description: 'Revenue, expenses, and net income for a period',
    href: '/accounting/reports/profit-loss',
    icon: TrendingUp,
  },
  {
    title: 'Balance Sheet',
    description: 'Assets, liabilities, and equity at a point in time',
    href: '/accounting/reports/balance-sheet',
    icon: Scale,
  },
  {
    title: 'Cash Flow',
    description: 'Cash movements by operating, investing, and financing',
    href: '/accounting/reports/cash-flow',
    icon: DollarSign,
  },
  {
    title: 'Trial Balance',
    description: 'All accounts with debit and credit totals',
    href: '/accounting/reports/trial-balance',
    icon: ClipboardList,
  },
  {
    title: 'General Ledger',
    description: 'Transaction detail per account with running balances',
    href: '/accounting/reports/general-ledger',
    icon: BookOpen,
  },
  {
    title: 'AR Aging',
    description: 'Outstanding invoices bucketed by days past due',
    href: '/accounting/reports/ar-aging',
    icon: Clock,
  },
  {
    title: 'AP Aging',
    description: 'Outstanding bills bucketed by days past due',
    href: '/accounting/reports/ap-aging',
    icon: FileText,
  },
];

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const membership = await getAccountingMembershipForUser(supabase, user.id);

  if (!membership) {
    redirect('/accounting');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financial Reports</h1>
        <p className="text-muted-foreground mt-1">
          Generate and export financial reports
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="rounded-lg border bg-card p-5 hover:bg-accent/50 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <report.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold group-hover:text-primary transition-colors">
                  {report.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {report.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
