'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
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
import { toLocalDateString } from '@/lib/accounting/date';

type Account = Database['public']['Tables']['chart_of_accounts']['Row'];
type TaxRate = Database['public']['Tables']['tax_rates']['Row'];

interface LineItem {
  key: string;
  description: string;
  quantity: string;
  unit_price: string;
  account_id: string;
  tax_rate_id: string;
}

let lineKeyCounter = 0;

const emptyLine = (): LineItem => ({
  key: `bill-line-${++lineKeyCounter}`,
  description: '',
  quantity: '1',
  unit_price: '',
  account_id: '',
  tax_rate_id: '__none__',
});

interface BillFormProps {
  billId?: string;
}

export function BillForm({ billId }: BillFormProps) {
  const router = useRouter();
  const isEdit = Boolean(billId);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBill, setIsLoadingBill] = useState(isEdit);

  const [vendorName, setVendorName] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const today = toLocalDateString(new Date());
  const [billDate, setBillDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

  const fetchData = useCallback(async () => {
    try {
      const [accountsRes, taxRatesRes, settingsRes] = await Promise.all([
        fetch('/api/accounting/accounts?active=true'),
        fetch('/api/accounting/tax-rates?active=all'),
        fetch('/api/accounting/settings'),
      ]);

      if (accountsRes.ok) {
        const { data } = await accountsRes.json();
        setAccounts(data);
      }
      if (taxRatesRes.ok) {
        const { data } = await taxRatesRes.json();
        setTaxRates(data);
      }

      if (billId) {
        const billRes = await fetch(`/api/accounting/bills/${billId}`);
        if (billRes.ok) {
          const { data } = await billRes.json();
          if (data.status !== 'draft') {
            toast.error('Only draft bills can be edited');
            router.push(`/accounting/bills/${billId}`);
            return;
          }
          setVendorName(data.vendor_name || '');
          setVendorEmail(data.vendor_email || '');
          setVendorAddress(data.vendor_address || '');
          setBillDate(data.bill_date || today);
          setDueDate(data.due_date || '');
          setNotes(data.notes || '');
          if (data.bill_line_items?.length) {
            setLines(
              data.bill_line_items
                .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
                .map((li: { description: string; quantity: number; unit_price: number; account_id: string | null; tax_rate_id: string | null }) => ({
                  key: `bill-line-${++lineKeyCounter}`,
                  description: li.description || '',
                  quantity: String(Number(li.quantity)),
                  unit_price: String(Number(li.unit_price)),
                  account_id: li.account_id || '',
                  tax_rate_id: li.tax_rate_id || '__none__',
                }))
            );
          }
        } else {
          toast.error('Failed to load bill');
          router.push('/accounting/bills');
          return;
        }
      }

      if (!billId && settingsRes.ok) {
        const { data } = await settingsRes.json();
        if (data.default_payment_terms) {
          setDueDate((prev) => {
            if (prev) return prev;
            const due = new Date();
            due.setDate(due.getDate() + data.default_payment_terms);
            return toLocalDateString(due);
          });
        }
      }
    } catch {
      if (billId) {
        toast.error('Failed to load bill');
        router.push('/accounting/bills');
      }
    } finally {
      setIsLoadingBill(false);
    }
  }, [billId, router, today]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const expenseAccounts = accounts.filter((a) => a.account_type === 'expense');
  const availableTaxRates = (selectedId: string) =>
    taxRates.filter((rate) => rate.is_active || rate.id === selectedId);

  const updateLine = (index: number, field: keyof LineItem, value: string) => {
    setLines((prev) => {
      const next = [...prev];
      const current = next[index]!;
      next[index] = { ...current, [field]: value };
      return next;
    });
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const getLineAmount = (line: LineItem) => {
    const qty = parseFloat(line.quantity) || 0;
    const price = parseFloat(line.unit_price) || 0;
    return qty * price;
  };

  const getLineTax = (line: LineItem) => {
    const amount = getLineAmount(line);
    if (line.tax_rate_id === '__none__') return 0;
    const rate = taxRates.find((r) => r.id === line.tax_rate_id);
    return amount * Number(rate?.rate ?? 0);
  };

  const subtotal = lines.reduce((sum, l) => sum + getLineAmount(l), 0);
  const taxTotal = lines.reduce((sum, l) => sum + getLineTax(l), 0);
  const total = subtotal + taxTotal;

  const lineHasAnyInput = (line: LineItem) =>
    Boolean(
      line.description.trim()
      || line.account_id
      || line.tax_rate_id !== '__none__'
      || (line.unit_price && parseFloat(line.unit_price) > 0)
      || (line.quantity && parseFloat(line.quantity) !== 1)
    );

  const lineIsComplete = (line: LineItem) =>
    Boolean(
      line.description.trim()
      && line.account_id
      && parseFloat(line.quantity) > 0
      && parseFloat(line.unit_price) > 0
    );

  const hasValidLines = lines.some(lineIsComplete);
  const hasInvalidLines = lines.some((line) => lineHasAnyInput(line) && !lineIsComplete(line));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vendorName.trim()) {
      toast.error('Vendor name is required');
      return;
    }

    if (!hasValidLines) {
      toast.error('At least one line item with description, account, and price is required');
      return;
    }

    if (hasInvalidLines) {
      toast.error('Complete or remove any partially filled line items before saving');
      return;
    }

    setIsLoading(true);
    try {
      const lineItemsPayload = lines
        .filter(lineIsComplete)
        .map((l, i) => ({
          description: l.description.trim(),
          quantity: parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unit_price) || 0,
          account_id: l.account_id,
          tax_rate_id: l.tax_rate_id === '__none__' ? null : l.tax_rate_id,
          sort_order: i,
        }));

      if (isEdit) {
        const payload = {
          vendor_name: vendorName.trim(),
          vendor_email: vendorEmail.trim() || null,
          vendor_address: vendorAddress.trim() || null,
          bill_date: billDate,
          due_date: dueDate || billDate,
          notes: notes.trim() || null,
          line_items: lineItemsPayload,
        };

        const response = await fetch(`/api/accounting/bills/${billId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const { error } = await response.json();
          throw new Error(error);
        }

        toast.success('Bill updated');
        router.push(`/accounting/bills/${billId}`);
      } else {
        const payload = {
          vendor_name: vendorName.trim(),
          vendor_email: vendorEmail.trim() || undefined,
          vendor_address: vendorAddress.trim() || undefined,
          bill_date: billDate,
          due_date: dueDate || billDate,
          notes: notes.trim() || undefined,
          line_items: lineItemsPayload,
        };

        const response = await fetch('/api/accounting/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const { error } = await response.json();
          throw new Error(error);
        }

        const { data } = await response.json();
        toast.success('Bill created');
        router.push(`/accounting/bills/${data.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (n: number) => n.toFixed(2);

  const backUrl = isEdit ? `/accounting/bills/${billId}` : '/accounting/bills';

  if (isLoadingBill) {
    return <div className="text-muted-foreground text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(backUrl)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{isEdit ? 'Edit Bill' : 'New Bill'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Vendor Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vendor-name">Vendor Name *</Label>
            <Input
              id="vendor-name"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-email">Vendor Email</Label>
            <Input
              id="vendor-email"
              type="email"
              value={vendorEmail}
              onChange={(e) => setVendorEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-address">Address</Label>
            <Input
              id="vendor-address"
              value={vendorAddress}
              onChange={(e) => setVendorAddress(e.target.value)}
            />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bill-date">Bill Date</Label>
            <Input
              id="bill-date"
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due-date">Due Date</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={1}
              placeholder="Internal notes"
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-2">
          <Label>Line Items</Label>
          <div className="rounded-md border">
            <div className="grid grid-cols-[2fr_80px_120px_1fr_1fr_100px_40px] gap-2 p-2 bg-muted/50 text-sm font-medium">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit Price</span>
              <span>Expense Account</span>
              <span>Tax Rate</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            {lines.map((line, i) => (
              <div key={line.key} className="grid grid-cols-[2fr_80px_120px_1fr_1fr_100px_40px] gap-2 p-2 border-t">
                <Input
                  className="h-9"
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) => updateLine(i, 'description', e.target.value)}
                />
                <Input
                  className="h-9 text-right font-mono"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={line.quantity}
                  onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                />
                <Input
                  className="h-9 text-right font-mono"
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="0.00"
                  value={line.unit_price}
                  onChange={(e) => updateLine(i, 'unit_price', e.target.value)}
                />
                <Select value={line.account_id || '__none__'} onValueChange={(v) => updateLine(i, 'account_id', v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select account</SelectItem>
                    {expenseAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.account_code} - {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={line.tax_rate_id} onValueChange={(v) => updateLine(i, 'tax_rate_id', v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="No Tax" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No Tax</SelectItem>
                    {availableTaxRates(line.tax_rate_id).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({(Number(r.rate) * 100).toFixed(2)}%){!r.is_active ? ' (Inactive)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="h-9 flex items-center justify-end font-mono text-sm">
                  {formatCurrency(getLineAmount(line))}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground"
                  onClick={() => removeLine(i)}
                  disabled={lines.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            {/* Totals */}
            <div className="p-3 border-t bg-muted/50 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>
              {taxTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span className="font-mono">{formatCurrency(taxTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-1 border-t">
                <span>Total</span>
                <span className="font-mono">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Line
          </Button>
        </div>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={isLoading || !hasValidLines || hasInvalidLines || !vendorName.trim()}
          >
            {isLoading
              ? (isEdit ? 'Saving...' : 'Creating...')
              : (isEdit ? 'Save Changes' : 'Create Draft Bill')}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push(backUrl)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
