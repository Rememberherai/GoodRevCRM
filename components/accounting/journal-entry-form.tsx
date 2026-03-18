'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
import { toast } from 'sonner';
import type { Database } from '@/types/database';

type Account = Database['public']['Tables']['chart_of_accounts']['Row'];

interface LineItem {
  key: string;
  account_id: string;
  description: string;
  debit: string;
  credit: string;
}

interface JournalEntryFormProps {
  onSuccess: () => void;
}

let lineKeyCounter = 0;

const emptyLine = (): LineItem => ({
  key: `line-${++lineKeyCounter}`,
  account_id: '',
  description: '',
  debit: '',
  credit: '',
});

export function JournalEntryForm({ onSuccess }: JournalEntryFormProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [memo, setMemo] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<LineItem[]>([emptyLine(), emptyLine()]);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch('/api/accounting/accounts');
      if (!response.ok) return;
      const { data } = await response.json();
      setAccounts(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const updateLine = (index: number, field: keyof LineItem, value: string) => {
    setLines((prev) => {
      const next = [...prev];
      const current = next[index]!;
      const updated: LineItem = {
        key: current.key,
        account_id: current.account_id,
        description: current.description,
        debit: current.debit,
        credit: current.credit,
      };
      updated[field] = value;

      // If entering debit, clear credit and vice versa
      if (field === 'debit' && value) {
        updated.credit = '';
      } else if (field === 'credit' && value) {
        updated.debit = '';
      }

      next[index] = updated;
      return next;
    });
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005;
  const hasValidLines = lines.filter((l) => l.account_id && (parseFloat(l.debit) || parseFloat(l.credit))).length >= 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isBalanced) {
      toast.error('Debits must equal credits');
      return;
    }

    if (!hasValidLines) {
      toast.error('At least 2 lines with amounts are required');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        entry_date: entryDate,
        memo: memo.trim() || undefined,
        reference: reference.trim() || undefined,
        source_type: 'manual',
        lines: lines
          .filter((l) => l.account_id && (parseFloat(l.debit) || parseFloat(l.credit)))
          .map((l) => ({
            account_id: l.account_id,
            description: l.description.trim() || undefined,
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
          })),
      };

      const response = await fetch('/api/accounting/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }

      toast.success('Journal entry created');
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (n: number) => n.toFixed(2);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="entry-date">Date</Label>
          <Input
            id="entry-date"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reference">Reference</Label>
          <Input
            id="reference"
            placeholder="Optional"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="memo">Memo</Label>
          <Textarea
            id="memo"
            placeholder="Description of this entry"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={1}
          />
        </div>
      </div>

      {/* Lines */}
      <div className="space-y-2">
        <Label>Lines</Label>
        <div className="rounded-md border">
          <div className="grid grid-cols-[1fr_1fr_120px_120px_40px] gap-2 p-2 bg-muted/50 text-sm font-medium">
            <span>Account</span>
            <span>Description</span>
            <span className="text-right">Debit</span>
            <span className="text-right">Credit</span>
            <span />
          </div>
          {lines.map((line, i) => (
            <div key={line.key} className="grid grid-cols-[1fr_1fr_120px_120px_40px] gap-2 p-2 border-t">
              <Select value={line.account_id} onValueChange={(v) => updateLine(i, 'account_id', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.account_code} - {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-9"
                placeholder="Description"
                value={line.description}
                onChange={(e) => updateLine(i, 'description', e.target.value)}
              />
              <Input
                className="h-9 text-right font-mono"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={line.debit}
                onChange={(e) => updateLine(i, 'debit', e.target.value)}
              />
              <Input
                className="h-9 text-right font-mono"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={line.credit}
                onChange={(e) => updateLine(i, 'credit', e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground"
                onClick={() => removeLine(i)}
                disabled={lines.length <= 2}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {/* Totals */}
          <div className="grid grid-cols-[1fr_1fr_120px_120px_40px] gap-2 p-2 border-t bg-muted/50">
            <span className="col-span-2 text-sm font-medium text-right">Totals</span>
            <span className={`text-right font-mono text-sm font-medium ${!isBalanced ? 'text-destructive' : ''}`}>
              {formatCurrency(totalDebit)}
            </span>
            <span className={`text-right font-mono text-sm font-medium ${!isBalanced ? 'text-destructive' : ''}`}>
              {formatCurrency(totalCredit)}
            </span>
            <span />
          </div>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Line
        </Button>

        {!isBalanced && totalDebit + totalCredit > 0 && (
          <p className="text-sm text-destructive">
            Out of balance by {formatCurrency(Math.abs(totalDebit - totalCredit))}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading || !isBalanced || !hasValidLines}>
        {isLoading ? 'Creating...' : 'Create Journal Entry'}
      </Button>
    </form>
  );
}
