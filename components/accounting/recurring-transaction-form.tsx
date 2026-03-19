'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Loader2 } from 'lucide-react';

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  account_id?: string | null;
}

export function RecurringTransactionForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');

  const [type, setType] = useState<'invoice' | 'bill'>('invoice');
  const [name, setName] = useState('');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [counterpartyEmail, setCounterpartyEmail] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState(localDateString(new Date()));
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0.01 },
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadCompanyCurrency() {
      try {
        const res = await fetch('/api/accounting/company');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.company?.base_currency) {
          setCurrency(data.company.base_currency);
        }
      } catch {
        // Leave USD fallback if the company fetch fails.
      }
    }

    loadCompanyCurrency();
    return () => {
      cancelled = true;
    };
  }, []);

  const addLine = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const removeLine = (idx: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof LineItem, value: string | number) => {
    setLineItems(
      lineItems.map((li, i) => (i === idx ? { ...li, [field]: value } : li)),
    );
  };

  const total = lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unit_price,
    0,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (endDate && endDate < startDate) {
        throw new Error('End date cannot be before start date');
      }

      if (lineItems.some((li) => !li.description.trim())) {
        throw new Error('Each recurring line item needs a description');
      }

      const res = await fetch('/api/accounting/recurring-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name,
          counterparty_name: counterpartyName,
          counterparty_email: counterpartyEmail || undefined,
          frequency,
          start_date: startDate,
          end_date: endDate || undefined,
          notes: notes || undefined,
          line_items: lineItems.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unit_price: li.unit_price,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create');
      }

      router.push('/accounting/recurring');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'invoice' | 'bill')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="bill">Bill</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Monthly hosting fee"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{type === 'invoice' ? 'Customer Name' : 'Vendor Name'}</Label>
              <Input
                value={counterpartyName}
                onChange={(e) => setCounterpartyName(e.target.value)}
                placeholder="Acme Corp"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={counterpartyEmail}
                onChange={(e) => setCounterpartyEmail(e.target.value)}
                placeholder="billing@acme.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>End Date (optional)</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" />
              Add Line
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {lineItems.map((li, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <Input
                className="flex-1"
                value={li.description}
                onChange={(e) => updateLine(idx, 'description', e.target.value)}
                placeholder="Description"
                required
              />
              <Input
                className="w-20"
                type="number"
                min={1}
                step={1}
                value={li.quantity}
                onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
              />
              <Input
                className="w-32"
                type="number"
                min={0}
                step={0.01}
                value={li.unit_price}
                onChange={(e) => updateLine(idx, 'unit_price', Number(e.target.value))}
                placeholder="0.00"
              />
              <span className="text-sm font-mono w-24 text-right">
                {(li.quantity * li.unit_price).toLocaleString('en-US', {
                  style: 'currency',
                  currency,
                })}
              </span>
              {lineItems.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeLine(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <div className="flex justify-end pt-2 border-t">
            <span className="text-sm font-semibold">
              Total:{' '}
              <span className="font-mono">
                {total.toLocaleString('en-US', { style: 'currency', currency })}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes to include on generated invoices/bills..."
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create Recurring Transaction
        </Button>
      </div>
    </form>
  );
}
