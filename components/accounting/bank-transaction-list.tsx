'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Upload, CheckCircle2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import { BankTransactionForm } from './bank-transaction-form';
import { BankImport } from './bank-import';
import type { Database } from '@/types/database';

interface BankAccount {
  id: string;
  name: string;
  institution: string | null;
  account_number_last4: string | null;
  account_type: string;
  currency: string;
  current_balance: number;
  chart_of_accounts: { id: string; account_code: string; name: string } | null;
}

interface BankTransaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: string;
  reference: string | null;
  is_reconciled: boolean;
  import_source: string;
}

interface BankTransactionListProps {
  bankAccountId: string;
  role: Database['public']['Enums']['accounting_role'];
}

export function BankTransactionList({ bankAccountId, role }: BankTransactionListProps) {
  const router = useRouter();
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reconciledFilter, setReconciledFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const canManage = role !== 'viewer';

  const fetchAccount = useCallback(async () => {
    try {
      const response = await fetch(`/api/accounting/bank-accounts/${bankAccountId}`);
      if (!response.ok) {
        toast.error('Bank account not found');
        return;
      }
      const { data } = await response.json();
      setAccount(data);
    } catch {
      toast.error('Failed to load bank account');
    }
  }, [bankAccountId]);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (reconciledFilter !== 'all') params.set('reconciled', reconciledFilter);

      const response = await fetch(`/api/accounting/bank-accounts/${bankAccountId}/transactions?${params}`);
      if (!response.ok) {
        toast.error('Failed to load transactions');
        return;
      }

      const { data, pagination } = await response.json();
      setTransactions(data);
      setTotalPages(pagination.totalPages);
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  }, [bankAccountId, page, reconciledFilter]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    setPage(1);
  }, [reconciledFilter]);

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  if (!account && !isLoading) {
    return <div className="text-muted-foreground text-center py-12">Bank account not found</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/accounting/bank-accounts')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{account?.name ?? 'Loading...'}</h1>
            {account && (
              <p className="text-muted-foreground text-sm">
                {account.institution && `${account.institution} · `}
                Balance: {formatCurrency(Number(account.current_balance), account.currency)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage ? (
            <>
              <Button variant="outline" onClick={() => setShowImport(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
              <Button onClick={() => router.push(`/accounting/bank-accounts/${bankAccountId}/reconcile`)}>
                <Shield className="h-4 w-4 mr-2" />
                Reconcile
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={reconciledFilter} onValueChange={setReconciledFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Transactions</SelectItem>
            <SelectItem value="false">Unreconciled</SelectItem>
            <SelectItem value="true">Reconciled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transaction Register */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-center">Reconciled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell>{txn.transaction_date}</TableCell>
                  <TableCell className="font-medium">{txn.description}</TableCell>
                  <TableCell className="text-muted-foreground">{txn.reference || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {txn.import_source}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-mono ${Number(txn.amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Number(txn.amount), account?.currency ?? 'USD')}
                  </TableCell>
                  <TableCell className="text-center">
                    {txn.is_reconciled && (
                      <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* Add Transaction Form */}
      {canManage && showAddForm && account && (
        <BankTransactionForm
          bankAccountId={bankAccountId}
          currency={account.currency}
          open={showAddForm}
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            setShowAddForm(false);
            fetchTransactions();
            fetchAccount();
          }}
        />
      )}

      {/* CSV Import */}
      {canManage && showImport && (
        <BankImport
          bankAccountId={bankAccountId}
          open={showImport}
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setShowImport(false);
            fetchTransactions();
            fetchAccount();
          }}
        />
      )}
    </div>
  );
}
