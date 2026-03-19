'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

type Account = Database['public']['Tables']['chart_of_accounts']['Row'];

interface BankAccountFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BankAccountForm({ open, onClose, onSuccess }: BankAccountFormProps) {
  const [glAccounts, setGlAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [last4, setLast4] = useState('');
  const [accountType, setAccountType] = useState('checking');
  const [currency, setCurrency] = useState('USD');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [accountId, setAccountId] = useState('');

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/accounting/accounts?active=true');
      if (!response.ok) {
        setGlAccounts([]);
        setAccountsError('Failed to load GL accounts');
        return;
      }
      const { data } = await response.json();
      setGlAccounts(data);
      setAccountsError(null);
    } catch {
      setGlAccounts([]);
      setAccountsError('Failed to load GL accounts');
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (open) {
      setName('');
      setInstitution('');
      setLast4('');
      setAccountType('checking');
      setCurrency('USD');
      setOpeningBalance('0');
      setAccountId('');
    }
  }, [open]);

  const assetAccounts = glAccounts.filter((a) => a.account_type === 'asset');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Account name is required');
      return;
    }

    if (accountsError) {
      toast.error(accountsError);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/accounting/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          institution: institution.trim() || null,
          account_number_last4: last4.trim() || null,
          account_type: accountType,
          currency,
          current_balance: parseFloat(openingBalance) || 0,
          account_id: accountId || null,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }

      toast.success('Bank account created');
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Bank Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {accountsError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {accountsError}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="bank-name">Account Name *</Label>
            <Input
              id="bank-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Business Checking"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank-institution">Institution</Label>
              <Input
                id="bank-institution"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g., Chase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-last4">Last 4 Digits</Label>
              <Input
                id="bank-last4"
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                maxLength={4}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-currency">Currency</Label>
              <Input
                id="bank-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                maxLength={3}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank-balance">Opening Balance</Label>
            <Input
              id="bank-balance"
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label>Linked GL Account</Label>
            <Select value={accountId || '__none__'} onValueChange={(v) => setAccountId(v === '__none__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select GL account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No linked account</SelectItem>
                {assetAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.account_code} - {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Creating...' : 'Create Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
