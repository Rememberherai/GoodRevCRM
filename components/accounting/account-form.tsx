'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import type { Database } from '@/types/database';

type Account = Database['public']['Tables']['chart_of_accounts']['Row'];

const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expense' },
];

const NORMAL_BALANCES: Record<string, string> = {
  asset: 'debit',
  liability: 'credit',
  equity: 'credit',
  revenue: 'credit',
  expense: 'debit',
};

interface AccountFormProps {
  account: Account | null;
  accounts: Account[];
  onSuccess: () => void;
}

export function AccountForm({ account, accounts, onSuccess }: AccountFormProps) {
  const isEditing = !!account;
  const [isLoading, setIsLoading] = useState(false);
  const [code, setCode] = useState(account?.account_code ?? '');
  const [name, setName] = useState(account?.name ?? '');
  const [description, setDescription] = useState(account?.description ?? '');
  const [accountType, setAccountType] = useState(account?.account_type ?? 'expense');
  const [parentId, setParentId] = useState<string>(account?.parent_id ?? '__none__');
  const [isActive, setIsActive] = useState(account?.is_active ?? true);

  const normalBalance = NORMAL_BALANCES[accountType] ?? 'debit';

  // Filter parent options to same type, exclude self
  const parentOptions = accounts.filter(
    (a) => a.account_type === accountType && a.id !== account?.id && a.is_active,
  );

  useEffect(() => {
    if (parentId === '__none__') {
      return;
    }

    const parentStillValid = parentOptions.some((a) => a.id === parentId);
    if (!parentStillValid) {
      setParentId('__none__');
    }
  }, [accountType, parentId, parentOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        account_code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        account_type: accountType,
        normal_balance: normalBalance,
        parent_id: parentId === '__none__' ? null : parentId || null,
        is_active: isActive,
      };

      const url = isEditing
        ? `/api/accounting/accounts/${account.id}`
        : '/api/accounting/accounts';

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }

      toast.success(isEditing ? 'Account updated' : 'Account created');
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="code">Account Code</Label>
          <Input
            id="code"
            placeholder="e.g. 1000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-type">Type</Label>
          <Select value={accountType} onValueChange={setAccountType} disabled={isEditing && account?.is_system}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          placeholder="e.g. Cash"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Optional description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      {parentOptions.length > 0 && (
        <div className="space-y-2">
          <Label>Parent Account</Label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger>
              <SelectValue placeholder="None (top-level)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None (top-level)</SelectItem>
              {parentOptions.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.account_code} - {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Normal balance: <span className="font-medium">{normalBalance}</span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="is-active">Active</Label>
          <Switch id="is-active" checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Saving...' : isEditing ? 'Update Account' : 'Create Account'}
      </Button>
    </form>
  );
}
