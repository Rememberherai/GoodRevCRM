'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AsOfDateFilter, downloadCSV, getTodayDateInputValue } from './report-filters';
import type { AgingReport } from '@/lib/accounting/reports';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const BUCKET_COLORS: Record<string, string> = {
  'Current': 'hsl(142, 76%, 36%)',
  '1-30': 'hsl(48, 96%, 53%)',
  '31-60': 'hsl(25, 95%, 53%)',
  '61-90': 'hsl(0, 84%, 60%)',
  '90+': 'hsl(0, 72%, 45%)',
};

const BUCKET_BADGE_COLORS: Record<string, string> = {
  'Current': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  '1-30': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  '31-60': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  '61-90': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  '90+': 'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-200',
};

interface AgingReportViewProps {
  type: 'ar' | 'ap';
}

export function AgingReportView({ type }: AgingReportViewProps) {
  const router = useRouter();
  const today = getTodayDateInputValue();
  const [asOfDate, setAsOfDate] = useState(today);
  const [report, setReport] = useState<AgingReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const endpoint = type === 'ar' ? 'ar-aging' : 'ap-aging';
  const detailPath = type === 'ar' ? '/accounting/invoices' : '/accounting/bills';

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (asOfDate) params.set('as_of_date', asOfDate);
      const res = await fetch(`/api/accounting/reports/${endpoint}?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const { data } = await res.json();
      setReport(data);
    } catch {
      setReport(null);
      setLoadError(`Failed to load ${type === 'ar' ? 'AR' : 'AP'} aging report`);
    } finally {
      setLoading(false);
    }
  }, [asOfDate, endpoint, type]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = () => {
    if (!report) return;
    const headers = ['Number', type === 'ar' ? 'Customer' : 'Vendor', 'Date', 'Due Date', 'Total', 'Balance Due', 'Days Past Due', 'Bucket'];
    const rows = report.rows.map((r) => [
      r.number,
      r.counterparty_name,
      r.date,
      r.due_date,
      fmt(r.total),
      fmt(r.balance_due),
      String(r.days_past_due),
      r.bucket,
    ]);
    downloadCSV(`${type}-aging-${asOfDate}`, headers, rows);
  };

  return (
    <div className="space-y-4">
      <AsOfDateFilter
        asOfDate={asOfDate}
        onDateChange={setAsOfDate}
        onApply={fetchReport}
        loading={loading}
        onExportCSV={report ? handleExport : undefined}
      />

      {loadError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      {report && (
        <>
          {/* Summary buckets */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {report.buckets.map((b) => (
              <div key={b.label} className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">{b.label} days</p>
                <p className="text-xl font-bold mt-1 font-mono">${fmt(b.amount)}</p>
                <p className="text-xs text-muted-foreground">{b.count} {type === 'ar' ? 'invoices' : 'bills'}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          {report.buckets.some((b) => b.amount > 0) && (
            <div className="rounded-lg border bg-card p-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.buckets}>
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value) => [`$${fmt(Number(value))}`, 'Amount']}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {report.buckets.map((b) => (
                      <Cell key={b.label} fill={BUCKET_COLORS[b.label] ?? '#888'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detail table */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <span className="font-semibold">
                Total Outstanding: ${fmt(report.total_outstanding)}
              </span>
              <span className="text-sm text-muted-foreground">
                {report.rows.length} {type === 'ar' ? 'invoices' : 'bills'}
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>{type === 'ar' ? 'Customer' : 'Vendor'}</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Balance Due</TableHead>
                  <TableHead className="text-right">Days Past Due</TableHead>
                  <TableHead>Bucket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => router.push(`${detailPath}/${r.id}`)}
                  >
                    <TableCell className="font-mono">{r.number}</TableCell>
                    <TableCell>{r.counterparty_name}</TableCell>
                    <TableCell>{r.due_date}</TableCell>
                    <TableCell className="text-right font-mono">${fmt(r.balance_due)}</TableCell>
                    <TableCell className="text-right">{r.days_past_due}</TableCell>
                    <TableCell>
                      <Badge className={BUCKET_BADGE_COLORS[r.bucket] ?? ''} variant="secondary">
                        {r.bucket}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {report.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      No outstanding {type === 'ar' ? 'invoices' : 'bills'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
