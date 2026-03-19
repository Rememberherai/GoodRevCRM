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
import type { BalanceSheetReport, BalanceSheetRow } from '@/lib/accounting/reports';

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SectionRows({ title, rows, total }: { title: string; rows: BalanceSheetRow[]; total: number }) {
  return (
    <>
      <TableRow className="bg-muted/50">
        <TableCell colSpan={3} className="font-semibold">
          {title}
        </TableCell>
      </TableRow>
      {rows.map((r) => (
        <TableRow key={r.account_id}>
          <TableCell className="text-muted-foreground">{r.account_code}</TableCell>
          <TableCell>{r.account_name}</TableCell>
          <TableCell className="text-right font-mono">{fmt(r.balance)}</TableCell>
        </TableRow>
      ))}
      {rows.length === 0 && (
        <TableRow>
          <TableCell colSpan={3} className="text-muted-foreground text-center py-2">
            No {title.toLowerCase()} accounts with balances
          </TableCell>
        </TableRow>
      )}
      <TableRow className="border-t-2 font-semibold">
        <TableCell />
        <TableCell>Total {title}</TableCell>
        <TableCell className="text-right font-mono">{fmt(total)}</TableCell>
      </TableRow>
    </>
  );
}

export function BalanceSheetReportView() {
  const today = getTodayDateInputValue();
  const [asOfDate, setAsOfDate] = useState(today);
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (asOfDate) params.set('as_of_date', asOfDate);
      const res = await fetch(`/api/accounting/reports/balance-sheet?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const { data } = await res.json();
      setReport(data);
    } catch {
      setReport(null);
      setLoadError('Failed to load balance sheet report');
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = () => {
    if (!report) return;
    const headers = ['Account Code', 'Account Name', 'Type', 'Balance'];
    const rows = [
      ...report.assets.map((r) => [r.account_code, r.account_name, 'Asset', fmt(r.balance)]),
      ['', '', 'Total Assets', fmt(report.total_assets)],
      ...report.liabilities.map((r) => [r.account_code, r.account_name, 'Liability', fmt(r.balance)]),
      ['', '', 'Total Liabilities', fmt(report.total_liabilities)],
      ...report.equity.map((r) => [r.account_code, r.account_name, 'Equity', fmt(r.balance)]),
      ['', '', 'Retained Earnings', fmt(report.retained_earnings)],
      ['', '', 'Total Equity', fmt(report.total_equity)],
    ];
    downloadCSV(`balance-sheet-${asOfDate}`, headers, rows);
  };

  const equityWithoutRetainedEarnings = report
    ? report.total_equity - report.retained_earnings
    : 0;

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
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right w-36">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SectionRows title="Assets" rows={report.assets} total={report.total_assets} />
              <SectionRows title="Liabilities" rows={report.liabilities} total={report.total_liabilities} />
              <TableRow className="bg-muted/50">
                <TableCell colSpan={3} className="font-semibold">
                  Equity
                </TableCell>
              </TableRow>
              {report.equity.map((r) => (
                <TableRow key={r.account_id}>
                  <TableCell className="text-muted-foreground">{r.account_code}</TableCell>
                  <TableCell>{r.account_name}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(r.balance)}</TableCell>
                </TableRow>
              ))}
              {report.equity.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground text-center py-2">
                    No equity accounts with balances
                  </TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell />
                <TableCell className="italic text-muted-foreground pl-8">
                  Retained Earnings (current period)
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {fmt(report.retained_earnings)}
                </TableCell>
              </TableRow>
              <TableRow className="border-t-2 font-semibold">
                <TableCell />
                <TableCell>Total Equity</TableCell>
                <TableCell className="text-right font-mono">
                  {fmt(equityWithoutRetainedEarnings + report.retained_earnings)}
                </TableCell>
              </TableRow>

              {/* Balance check */}
              <TableRow className="border-t-4 font-bold text-lg">
                <TableCell />
                <TableCell>Liabilities + Equity</TableCell>
                <TableCell className="text-right font-mono">
                  {fmt(report.total_liabilities + report.total_equity)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell />
                <TableCell className="text-muted-foreground text-sm">
                  Difference (should be 0)
                </TableCell>
                <TableCell
                  className={`text-right font-mono text-sm ${
                    Math.abs(report.total_assets - report.total_liabilities - report.total_equity) < 0.01
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {fmt(report.total_assets - report.total_liabilities - report.total_equity)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
