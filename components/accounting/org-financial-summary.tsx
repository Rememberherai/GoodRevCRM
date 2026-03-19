'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Summary {
  total_invoiced: number;
  ar_outstanding: number;
  total_billed: number;
  ap_outstanding: number;
  total_payments_received: number;
  total_payments_made: number;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total: number;
  balance_due: number;
  customer_name: string;
}

interface BillRow {
  id: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  status: string;
  total: number;
  balance_due: number;
  vendor_name: string;
}

interface PaymentRow {
  id: string;
  payment_date: string;
  payment_type: string;
  amount: number;
  payment_method: string | null;
  notes: string | null;
}

interface OrgFinancialData {
  summary: Summary;
  invoices: InvoiceRow[];
  bills: BillRow[];
  payments: PaymentRow[];
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  received: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  partially_paid: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  voided: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

interface OrgFinancialSummaryProps {
  organizationId: string;
}

export function OrgFinancialSummary({ organizationId }: OrgFinancialSummaryProps) {
  const [data, setData] = useState<OrgFinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccounting, setHasAccounting] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/accounting/org-summary?organization_id=${organizationId}`,
        );
        if (res.status === 401) {
          setHasAccounting(false);
          return;
        }
        if (!res.ok) throw new Error('Failed');
        const { data } = await res.json();
        setData(data);
      } catch {
        setHasAccounting(false);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [organizationId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 animate-pulse">
              <div className="h-3 w-20 bg-muted rounded mb-2" />
              <div className="h-6 w-24 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasAccounting) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Set up accounting to see financial data for this organization.</p>
        <Link href="/accounting" className="text-primary hover:underline text-sm mt-2 inline-block">
          Go to Accounting
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-muted-foreground text-center py-6">
        No financial data available.
      </p>
    );
  }

  const { summary, invoices, bills, payments } = data;
  const hasInvoices = invoices.length > 0;
  const hasBills = bills.length > 0;
  const hasPayments = payments.length > 0;
  const hasData = hasInvoices || hasBills || hasPayments;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Invoiced</p>
          <p className="text-lg font-bold mt-1 font-mono">{fmt(summary.total_invoiced)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">AR Outstanding</p>
          <p className="text-lg font-bold mt-1 font-mono">{fmt(summary.ar_outstanding)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Payments Received</p>
          <p className="text-lg font-bold mt-1 font-mono">{fmt(summary.total_payments_received)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Billed</p>
          <p className="text-lg font-bold mt-1 font-mono">{fmt(summary.total_billed)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">AP Outstanding</p>
          <p className="text-lg font-bold mt-1 font-mono">{fmt(summary.ap_outstanding)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Payments Made</p>
          <p className="text-lg font-bold mt-1 font-mono">{fmt(summary.total_payments_made)}</p>
        </div>
      </div>

      {!hasData && (
        <p className="text-muted-foreground text-center py-4">
          No invoices, bills, or payments recorded for this organization.
        </p>
      )}

      {/* Invoices */}
      {hasInvoices && (
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b">
            <h4 className="font-semibold text-sm">Recent Invoices</h4>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link
                      href={`/accounting/invoices/${inv.id}`}
                      className="text-primary hover:underline font-mono text-sm"
                    >
                      {inv.invoice_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{inv.invoice_date}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[inv.status] ?? ''} variant="secondary">
                      {inv.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmt(Number(inv.total))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmt(Number(inv.balance_due))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bills */}
      {hasBills && (
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b">
            <h4 className="font-semibold text-sm">Recent Bills</h4>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell>
                    <Link
                      href={`/accounting/bills/${bill.id}`}
                      className="text-primary hover:underline font-mono text-sm"
                    >
                      {bill.bill_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{bill.bill_date}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[bill.status] ?? ''} variant="secondary">
                      {bill.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmt(Number(bill.total))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmt(Number(bill.balance_due))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Payments */}
      {hasPayments && (
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b">
            <h4 className="font-semibold text-sm">Recent Payments</h4>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((pmt) => (
                <TableRow key={pmt.id}>
                  <TableCell className="text-sm">{pmt.payment_date}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {pmt.payment_type === 'received' ? 'Received' : 'Made'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {pmt.payment_method?.replace('_', ' ') ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {pmt.notes || '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmt(Number(pmt.amount))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
