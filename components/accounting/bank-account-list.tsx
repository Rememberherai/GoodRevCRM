'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Building2 } from 'lucide-react';
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
import { toast } from 'sonner';
import { BankAccountForm } from './bank-account-form';

interface BankAccount {
  id: string;
  name: string;
  institution: string | null;
  account_number_last4: string | null;
  account_type: string;
  currency: string;
  current_balance: number;
  is_active: boolean;
  chart_of_accounts: { id: string; account_code: string; name: string } | null;
}

const TYPE_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
  other: 'Other',
};

interface BankAccountListProps {
  canManage: boolean;
}

export function BankAccountList({ canManage }: BankAccountListProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/accounting/bank-accounts');
      if (!response.ok) {
        toast.error('Failed to load bank accounts');
        return;
      }
      const { data } = await response.json();
      setAccounts(data);
    } catch {
      toast.error('Failed to load bank accounts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bank Accounts</h1>
        {canManage ? (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        ) : null}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Institution</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>GL Account</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-8 w-8 text-muted-foreground/50" />
                    <p>No bank accounts yet</p>
                    {canManage ? (
                      <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                        Add your first account
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow
                  key={account.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/accounting/bank-accounts/${account.id}`)}
                >
                  <TableCell>
                    <div>
                      <span className="font-medium">{account.name}</span>
                      {account.account_number_last4 && (
                        <span className="text-muted-foreground ml-2">
                          ****{account.account_number_last4}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {account.institution || '—'}
                  </TableCell>
                  <TableCell>{TYPE_LABELS[account.account_type] ?? account.account_type}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {account.chart_of_accounts
                      ? `${account.chart_of_accounts.account_code} - ${account.chart_of_accounts.name}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(Number(account.current_balance), account.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={account.is_active ? 'default' : 'secondary'}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {canManage ? (
        <BankAccountForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            fetchAccounts();
          }}
        />
      ) : null}
    </div>
  );
}
