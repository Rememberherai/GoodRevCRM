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
import type { CashFlowReport, CashFlowCategory } from '@/lib/accounting/reports';

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CategorySection({ category }: { category: CashFlowCategory }) {
  return (
    <>
      <TableRow className="bg-muted/50">
        <TableCell colSpan={2} className="font-semibold">
          {category.label}
        </TableCell>
      </TableRow>
      {category.items.map((item, i) => (
        <TableRow key={i}>
          <TableCell className="pl-8">{item.account_name}</TableCell>
          <TableCell
            className={`text-right font-mono ${item.amount >= 0 ? '' : 'text-red-600'}`}
          >
            {fmt(item.amount)}
          </TableCell>
        </TableRow>
      ))}
      {category.items.length === 0 && (
        <TableRow>
          <TableCell colSpan={2} className="text-muted-foreground text-center py-2">
            No {category.label.toLowerCase()} activity
          </TableCell>
        </TableRow>
      )}
      <TableRow className="border-t font-semibold">
        <TableCell className="pl-8">Net {category.label}</TableCell>
        <TableCell
          className={`text-right font-mono ${category.total >= 0 ? '' : 'text-red-600'}`}
        >
          {fmt(category.total)}
        </TableCell>
      </TableRow>
    </>
  );
}

export function CashFlowReportView() {
  const today = new Date();
  const yearStart = `${today.getFullYear()}-01-01`;
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(getTodayDateInputValue());
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const res = await fetch(`/api/accounting/reports/cash-flow?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const { data } = await res.json();
      setReport(data);
    } catch {
      console.error('Failed to load cash flow');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = () => {
    if (!report) return;
    const headers = ['Category', 'Amount'];
    const rows: string[][] = [
      ['Opening Cash', fmt(report.opening_cash)],
      ['--- Operating Activities ---', ''],
      ...report.operating.items.map((i) => [i.account_name, fmt(i.amount)]),
      ['Net Operating', fmt(report.operating.total)],
      ['--- Investing Activities ---', ''],
      ...report.investing.items.map((i) => [i.account_name, fmt(i.amount)]),
      ['Net Investing', fmt(report.investing.total)],
      ['--- Financing Activities ---', ''],
      ...report.financing.items.map((i) => [i.account_name, fmt(i.amount)]),
      ['Net Financing', fmt(report.financing.total)],
      ['Net Change in Cash', fmt(report.net_change)],
      ['Closing Cash', fmt(report.closing_cash)],
    ];
    downloadCSV(`cash-flow-${startDate}-to-${endDate}`, headers, rows);
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

      {report && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right w-36">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Opening cash */}
              <TableRow className="font-semibold">
                <TableCell>Opening Cash Balance</TableCell>
                <TableCell className="text-right font-mono">{fmt(report.opening_cash)}</TableCell>
              </TableRow>

              <CategorySection category={report.operating} />
              <CategorySection category={report.investing} />
              <CategorySection category={report.financing} />

              {/* Net change */}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Net Change in Cash</TableCell>
                <TableCell
                  className={`text-right font-mono ${report.net_change >= 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {fmt(report.net_change)}
                </TableCell>
              </TableRow>

              {/* Closing cash */}
              <TableRow className="border-t-4 font-bold text-lg">
                <TableCell>Closing Cash Balance</TableCell>
                <TableCell className="text-right font-mono">{fmt(report.closing_cash)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
