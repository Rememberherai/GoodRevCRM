'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { Database } from '@/types/database';
import { toLocalDateString } from '@/lib/accounting/date';

type Account = Database['public']['Tables']['chart_of_accounts']['Row'];

interface BillPaymentFormProps {
  billId: string;
  billNumber: string;
  balanceDue: number;
  currency: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BillPaymentForm({ billId, billNumber, balanceDue, currency, open, onClose, onSuccess }: BillPaymentFormProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const [paymentDate, setPaymentDate] = useState(() => toLocalDateString(new Date()));
  const [amount, setAmount] = useState(balanceDue.toFixed(2));
  const [paymentMethod, setPaymentMethod] = useState('__none__');
  const [accountId, setAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/accounting/accounts?active=true');
      if (!response.ok) {
        setAccounts([]);
        setAccountsError('Failed to load payment accounts');
        return;
      }
      const { data } = await response.json();
      setAccounts(data);
      setAccountsError(null);
    } catch {
      setAccounts([]);
      setAccountsError('Failed to load payment accounts');
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (!open) return;
    setPaymentDate(toLocalDateString(new Date()));
    setAmount(balanceDue.toFixed(2));
    setPaymentMethod('__none__');
    setAccountId('');
    setReference('');
    setNotes('');
  }, [balanceDue, open, billId]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  // Filter to asset accounts (cash, bank, etc.)
  const cashAccounts = accounts.filter((a) => a.account_type === 'asset');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Amount must be positive');
      return;
    }

    if (parsedAmount > balanceDue) {
      toast.error(`Amount cannot exceed balance due (${formatCurrency(balanceDue)})`);
      return;
    }

    if (accountsError) {
      toast.error(accountsError);
      return;
    }

    if (!accountId) {
      toast.error('Please select a payment account');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        bill_id: billId,
        payment_date: paymentDate,
        amount: parsedAmount,
        account_id: accountId,
        payment_method: paymentMethod === '__none__' ? null : paymentMethod,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      };

      const response = await fetch('/api/accounting/bill-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }

      toast.success('Payment recorded');
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record payment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment — {billNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Balance due: <span className="font-mono font-medium">{formatCurrency(balanceDue)}</span>
          </div>

          {accountsError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {accountsError}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment-date">Date</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={balanceDue}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Account *</Label>
            <Select value={accountId || '__none__'} onValueChange={(v) => setAccountId(v === '__none__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select account</SelectItem>
                {cashAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.account_code} - {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not specified</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="ach">ACH</SelectItem>
                <SelectItem value="wire">Wire</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-reference">Reference</Label>
            <Input
              id="payment-reference"
              placeholder="Check #, transaction ID, etc."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-notes">Notes</Label>
            <Textarea
              id="payment-notes"
              placeholder="Optional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !accountId}>
              {isLoading ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
