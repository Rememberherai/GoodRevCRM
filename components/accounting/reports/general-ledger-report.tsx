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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DateRangeFilter, PresetButtons, downloadCSV, getTodayDateInputValue } from './report-filters';
import type { GeneralLedgerReport, GeneralLedgerAccount } from '@/lib/accounting/reports';

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Account {
  id: string;
  account_code: string;
  name: string;
}

export function GeneralLedgerReportView() {
  const router = useRouter();
  const today = new Date();
  const yearStart = `${today.getFullYear()}-01-01`;
  const [startDate, setStartDate] = useState(yearStart);
  const [endDate, setEndDate] = useState(getTodayDateInputValue());
  const [accountId, setAccountId] = useState<string>('all');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [report, setReport] = useState<GeneralLedgerReport | null>(null);
  const [loading, setLoading] = useState(false);

  // Load accounts for the filter dropdown
  useEffect(() => {
    async function loadAccounts() {
      const res = await fetch('/api/accounting/accounts?active=all');
      if (res.ok) {
        const { data } = await res.json();
        setAccounts(data ?? []);
      }
    }
    loadAccounts();
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      if (accountId && accountId !== 'all') params.set('account_id', accountId);
      const res = await fetch(`/api/accounting/reports/general-ledger?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const { data } = await res.json();
      setReport(data);
    } catch {
      console.error('Failed to load general ledger');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, accountId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = () => {
    if (!report) return;
    const headers = ['Account', 'Date', 'Entry #', 'Memo', 'Description', 'Debit', 'Credit', 'Balance'];
    const rows: string[][] = [];
    for (const acct of report.accounts) {
      rows.push([`${acct.account_code} - ${acct.account_name}`, '', '', '', '', '', '', fmt(acct.opening_balance)]);
      for (const e of acct.entries) {
        rows.push([
          '',
          e.entry_date,
          String(e.entry_number),
          e.memo ?? '',
          e.description ?? '',
          e.debit > 0 ? fmt(e.debit) : '',
          e.credit > 0 ? fmt(e.credit) : '',
          fmt(e.running_balance),
        ]);
      }
      rows.push(['', '', '', '', 'Closing Balance', '', '', fmt(acct.closing_balance)]);
    }
    downloadCSV(`general-ledger-${startDate}-to-${endDate}`, headers, rows);
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
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-60">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.account_code} - {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
      </div>

      {report && report.accounts.length === 0 && (
        <p className="text-muted-foreground text-sm">No transactions found for the selected period.</p>
      )}

      {report &&
        report.accounts.map((acct) => (
          <AccountLedger key={acct.account_id} account={acct} onClickEntry={(id) => router.push(`/accounting/journal-entries/${id}`)} />
        ))}
    </div>
  );
}

function AccountLedger({
  account,
  onClickEntry,
}: {
  account: GeneralLedgerAccount;
  onClickEntry: (jeId: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 py-3 border-b bg-muted/50">
        <span className="font-semibold">
          {account.account_code} - {account.account_name}
        </span>
        <span className="text-muted-foreground text-sm ml-2">({account.account_type})</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Date</TableHead>
            <TableHead className="w-20">Entry #</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right w-28">Debit</TableHead>
            <TableHead className="text-right w-28">Credit</TableHead>
            <TableHead className="text-right w-32">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Opening balance */}
          <TableRow className="bg-muted/30">
            <TableCell colSpan={5} className="text-muted-foreground italic">
              Opening Balance
            </TableCell>
            <TableCell className="text-right font-mono">{fmt(account.opening_balance)}</TableCell>
          </TableRow>

          {account.entries.map((e, i) => (
            <TableRow
              key={i}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => onClickEntry(e.journal_entry_id)}
            >
              <TableCell>{e.entry_date}</TableCell>
              <TableCell className="text-muted-foreground">JE-{e.entry_number}</TableCell>
              <TableCell className="truncate max-w-[300px]">
                {e.description || e.memo || '—'}
              </TableCell>
              <TableCell className="text-right font-mono">
                {e.debit > 0 ? fmt(e.debit) : ''}
              </TableCell>
              <TableCell className="text-right font-mono">
                {e.credit > 0 ? fmt(e.credit) : ''}
              </TableCell>
              <TableCell className="text-right font-mono">{fmt(e.running_balance)}</TableCell>
            </TableRow>
          ))}

          {account.entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-3">
                No transactions in this period
              </TableCell>
            </TableRow>
          )}

          {/* Closing balance */}
          <TableRow className="border-t-2 font-semibold bg-muted/30">
            <TableCell colSpan={5}>Closing Balance</TableCell>
            <TableCell className="text-right font-mono">{fmt(account.closing_balance)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
