'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { toLocalDateString } from '@/lib/accounting/date';

interface ReconciliationWizardProps {
  bankAccountId: string;
}

interface ReconciliationData {
  reconciliation: {
    id: string;
    statement_date: string;
    statement_ending_balance: number;
    status: string;
    bank_accounts: { id: string; name: string; current_balance: number; currency: string } | null;
  };
  transactions: Array<{
    id: string;
    transaction_date: string;
    description: string;
    amount: number;
    reference: string | null;
    is_reconciled: boolean;
    selected: boolean;
  }>;
  selected_total: number;
  difference: number;
  starting_balance: number;
}

export function ReconciliationWizard({ bankAccountId }: ReconciliationWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<'setup' | 'match'>('setup');
  const [statementDate, setStatementDate] = useState(toLocalDateString(new Date()));
  const [statementBalance, setStatementBalance] = useState('');
  const [reconciliationId, setReconciliationId] = useState<string | null>(null);
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Check for existing in-progress reconciliation
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const response = await fetch(`/api/accounting/bank-accounts/${bankAccountId}/reconciliations`);
        if (!response.ok) {
          setLoadError('Failed to load reconciliation status');
          return;
        }
        const { data: recons } = await response.json();
        const inProgress = recons?.find((r: { status: string }) => r.status === 'in_progress');
        if (inProgress) {
          setReconciliationId(inProgress.id);
          setStatementDate(inProgress.statement_date);
          setStatementBalance(String(Number(inProgress.statement_ending_balance)));
          setStep('match');
        }
      } catch {
        setLoadError('Failed to load reconciliation status');
      }
    };
    checkExisting();
  }, [bankAccountId]);

  const fetchReconciliationData = useCallback(async () => {
    if (!reconciliationId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/accounting/reconciliations/${reconciliationId}/items`);
      if (!response.ok) {
        setData(null);
        setLoadError('Failed to load reconciliation data');
        toast.error('Failed to load reconciliation data');
        return;
      }
      const { data: reconData } = await response.json();
      setData(reconData);
    } catch {
      setData(null);
      setLoadError('Failed to load reconciliation data');
      toast.error('Failed to load reconciliation data');
    } finally {
      setIsLoading(false);
    }
  }, [reconciliationId]);

  useEffect(() => {
    if (step === 'match' && reconciliationId) {
      fetchReconciliationData();
    }
  }, [step, reconciliationId, fetchReconciliationData]);

  const handleStartReconciliation = async () => {
    const balance = parseFloat(statementBalance);
    if (isNaN(balance)) {
      toast.error('Statement ending balance is required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/accounting/bank-accounts/${bankAccountId}/reconciliations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statement_date: statementDate,
          statement_ending_balance: balance,
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        if (body.existing_id) {
          setReconciliationId(body.existing_id);
          setStep('match');
          return;
        }
        throw new Error(body.error);
      }

      const { data: recon } = await response.json();
      setReconciliationId(recon.id);
      setStep('match');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start reconciliation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTransaction = async (transactionId: string) => {
    if (!reconciliationId) return;

    try {
      const response = await fetch(`/api/accounting/reconciliations/${reconciliationId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_transaction_id: transactionId }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }

      fetchReconciliationData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to toggle transaction');
    }
  };

  const handleComplete = async () => {
    if (!reconciliationId) return;

    setIsCompleting(true);
    try {
      const response = await fetch(`/api/accounting/reconciliations/${reconciliationId}/complete`, {
        method: 'POST',
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }

      toast.success('Reconciliation completed');
      router.push(`/accounting/bank-accounts/${bankAccountId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to complete reconciliation');
    } finally {
      setIsCompleting(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: data?.reconciliation.bank_accounts?.currency || 'USD',
    }).format(amount);

  if (step === 'setup') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/accounting/bank-accounts/${bankAccountId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Reconcile Account</h1>
        </div>

        <div className="max-w-md space-y-4">
          {loadError ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="stmt-date">Statement Date</Label>
            <Input
              id="stmt-date"
              type="date"
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stmt-balance">Statement Ending Balance</Label>
            <Input
              id="stmt-balance"
              type="number"
              step="0.01"
              value={statementBalance}
              onChange={(e) => setStatementBalance(e.target.value)}
              className="font-mono"
              placeholder="0.00"
              required
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleStartReconciliation} disabled={isLoading}>
              {isLoading ? 'Starting...' : 'Start Reconciliation'}
            </Button>
            <Button variant="outline" onClick={() => router.push(`/accounting/bank-accounts/${bankAccountId}`)}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loadError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/accounting/bank-accounts/${bankAccountId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Reconcile Account</h1>
            <p className="text-muted-foreground text-sm">
              Statement date: {statementDate} · Target: {formatCurrency(parseFloat(statementBalance) || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Starting Balance</p>
            <p className="text-xl font-mono font-bold">
              {formatCurrency(data.starting_balance ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Statement Ending Balance</p>
            <p className="text-xl font-mono font-bold">
              {formatCurrency(Number(data.reconciliation.statement_ending_balance))}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Selected Total</p>
            <p className="text-xl font-mono font-bold">
              {formatCurrency(data.selected_total)}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Difference</p>
            <p className={`text-xl font-mono font-bold ${Math.abs(data.difference) < 0.005 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.difference)}
            </p>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !data?.transactions.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No transactions to reconcile
                </TableCell>
              </TableRow>
            ) : (
              data.transactions.map((txn) => (
                <TableRow
                  key={txn.id}
                  className={`cursor-pointer ${txn.selected ? 'bg-green-50 dark:bg-green-950/20' : 'hover:bg-muted/50'}`}
                  onClick={() => handleToggleTransaction(txn.id)}
                >
                  <TableCell>
                    {txn.selected && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  </TableCell>
                  <TableCell>{txn.transaction_date}</TableCell>
                  <TableCell className="font-medium">{txn.description}</TableCell>
                  <TableCell className="text-muted-foreground">{txn.reference || '—'}</TableCell>
                  <TableCell className={`text-right font-mono ${Number(txn.amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Number(txn.amount))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push(`/accounting/bank-accounts/${bankAccountId}`)}>
          Save & Finish Later
        </Button>
        <div className="flex items-center gap-2">
          {data && Math.abs(data.difference) < 0.005 && (
            <Badge variant="default" className="bg-green-600">Balanced</Badge>
          )}
          <Button
            onClick={handleComplete}
            disabled={isCompleting || !data || Math.abs(data.difference) >= 0.005}
          >
            {isCompleting ? 'Completing...' : 'Complete Reconciliation'}
          </Button>
        </div>
      </div>
    </div>
  );
}
