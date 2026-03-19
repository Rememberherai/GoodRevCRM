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
import { DateRangeFilter, PresetButtons, downloadCSV, getTodayDateInputValue } from './report-filters';
import type { ProfitLossReport } from '@/lib/accounting/reports';

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ProfitLossReportView() {
  const today = new Date();
  const yearStart = `${today.getFullYear()}-01-01`;
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(getTodayDateInputValue());
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const res = await fetch(`/api/accounting/reports/profit-loss?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const { data } = await res.json();
      setReport(data);
    } catch {
      setReport(null);
      setLoadError('Failed to load profit and loss report');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = () => {
    if (!report) return;
    const headers = ['Account Code', 'Account Name', 'Type', 'Amount'];
    const rows = [
      ...report.revenue.map((r) => [r.account_code, r.account_name, 'Revenue', fmt(r.total)]),
      ['', '', 'Total Revenue', fmt(report.total_revenue)],
      ...report.expenses.map((r) => [r.account_code, r.account_name, 'Expense', fmt(r.total)]),
      ['', '', 'Total Expenses', fmt(report.total_expenses)],
      ['', '', 'Net Income', fmt(report.net_income)],
    ];
    downloadCSV(`profit-loss-${startDate}-to-${endDate}`, headers, rows);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <PresetButtons
          onSelect={(s, e) => {
            setStartDate(s);
            setEndDate(e);
          }}
        />
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onApply={fetchReport}
          loading={loading}
          onExportCSV={report ? handleExport : undefined}
        />
      </div>

      {loadError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      {report && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right w-36">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Revenue */}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={3} className="font-semibold">
                  Revenue
                </TableCell>
              </TableRow>
              {report.revenue.map((r) => (
                <TableRow key={r.account_id}>
                  <TableCell className="text-muted-foreground">{r.account_code}</TableCell>
                  <TableCell>{r.account_name}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(r.total)}</TableCell>
                </TableRow>
              ))}
              {report.revenue.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground text-center py-2">
                    No revenue entries
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="border-t-2 font-semibold">
                <TableCell />
                <TableCell>Total Revenue</TableCell>
                <TableCell className="text-right font-mono">{fmt(report.total_revenue)}</TableCell>
              </TableRow>

              {/* Expenses */}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={3} className="font-semibold">
                  Expenses
                </TableCell>
              </TableRow>
              {report.expenses.map((r) => (
                <TableRow key={r.account_id}>
                  <TableCell className="text-muted-foreground">{r.account_code}</TableCell>
                  <TableCell>{r.account_name}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(r.total)}</TableCell>
                </TableRow>
              ))}
              {report.expenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground text-center py-2">
                    No expense entries
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="border-t-2 font-semibold">
                <TableCell />
                <TableCell>Total Expenses</TableCell>
                <TableCell className="text-right font-mono">{fmt(report.total_expenses)}</TableCell>
              </TableRow>

              {/* Net Income */}
              <TableRow className="border-t-4 font-bold text-lg">
                <TableCell />
                <TableCell>Net Income</TableCell>
                <TableCell
                  className={`text-right font-mono ${report.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {fmt(report.net_income)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
