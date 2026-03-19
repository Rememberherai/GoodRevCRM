'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AsOfDateFilter, downloadCSV, getTodayDateInputValue } from './report-filters';

interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

interface TrialBalanceData {
  data: TrialBalanceRow[];
  as_of_date: string;
  totals: { total_debit: number; total_credit: number };
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TrialBalanceReportView() {
  const today = getTodayDateInputValue();
  const [asOfDate, setAsOfDate] = useState(today);
  const [report, setReport] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (asOfDate) params.set('as_of_date', asOfDate);
      const res = await fetch(`/api/accounting/trial-balance?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setReport(data);
    } catch {
      console.error('Failed to load trial balance');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = () => {
    if (!report) return;
    const headers = ['Account Code', 'Account Name', 'Type', 'Debit', 'Credit', 'Balance'];
    const rows = report.data.map((r) => [
      r.account_code,
      r.account_name,
      r.account_type,
      r.total_debit > 0 ? fmt(r.total_debit) : '',
      r.total_credit > 0 ? fmt(r.total_credit) : '',
      fmt(r.balance),
    ]);
    rows.push(['', '', 'TOTALS', fmt(report.totals.total_debit), fmt(report.totals.total_credit), '']);
    downloadCSV(`trial-balance-${asOfDate}`, headers, rows);
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

      {report && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="w-24">Type</TableHead>
                <TableHead className="text-right w-32">Debit</TableHead>
                <TableHead className="text-right w-32">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.data.map((r) => (
                <TableRow key={r.account_id}>
                  <TableCell className="text-muted-foreground">{r.account_code}</TableCell>
                  <TableCell>{r.account_name}</TableCell>
                  <TableCell className="text-muted-foreground capitalize text-xs">
                    {r.account_type}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {r.total_debit > 0 ? fmt(r.total_debit) : ''}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {r.total_credit > 0 ? fmt(r.total_credit) : ''}
                  </TableCell>
                </TableRow>
              ))}
              {report.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No posted transactions found
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="border-t-4 font-bold">
                <TableCell />
                <TableCell>Totals</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono">
                  {fmt(report.totals.total_debit)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {fmt(report.totals.total_credit)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} />
                <TableCell colSpan={2} className="text-center">
                  <span
                    className={`text-sm font-medium ${
                      Math.abs(report.totals.total_debit - report.totals.total_credit) < 0.01
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {Math.abs(report.totals.total_debit - report.totals.total_credit) < 0.01
                      ? 'Balanced'
                      : `Out of balance by ${fmt(Math.abs(report.totals.total_debit - report.totals.total_credit))}`}
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
