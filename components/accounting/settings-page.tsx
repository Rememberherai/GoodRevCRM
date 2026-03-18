'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import type { Database } from '@/types/database';

type Account = Database['public']['Tables']['chart_of_accounts']['Row'];
type Settings = Database['public']['Tables']['accounting_settings']['Row'];
type TaxRate = Database['public']['Tables']['tax_rates']['Row'];

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Settings form state
  const [paymentTerms, setPaymentTerms] = useState('30');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [invoiceFooter, setInvoiceFooter] = useState('');
  const [defaultRevenue, setDefaultRevenue] = useState('');
  const [defaultExpense, setDefaultExpense] = useState('');
  const [defaultAR, setDefaultAR] = useState('');
  const [defaultAP, setDefaultAP] = useState('');
  const [defaultCash, setDefaultCash] = useState('');
  const [defaultTaxLiability, setDefaultTaxLiability] = useState('');
  const [defaultFxGainLoss, setDefaultFxGainLoss] = useState('');

  // Tax rate form
  const [taxFormOpen, setTaxFormOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxRate | null>(null);
  const [taxName, setTaxName] = useState('');
  const [taxRateValue, setTaxRateValue] = useState('');
  const [taxDescription, setTaxDescription] = useState('');
  const [taxIsDefault, setTaxIsDefault] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, accountsRes, taxRes] = await Promise.all([
        fetch('/api/accounting/settings'),
        fetch('/api/accounting/accounts?active=all'),
        fetch('/api/accounting/tax-rates'),
      ]);

      if (settingsRes.ok) {
        const { data } = await settingsRes.json();
        setSettings(data);
        setPaymentTerms(String(data.default_payment_terms ?? 30));
        setInvoiceNotes(data.invoice_notes ?? '');
        setInvoiceFooter(data.invoice_footer ?? '');
        setDefaultRevenue(data.default_revenue_account_id ?? '');
        setDefaultExpense(data.default_expense_account_id ?? '');
        setDefaultAR(data.default_ar_account_id ?? '');
        setDefaultAP(data.default_ap_account_id ?? '');
        setDefaultCash(data.default_cash_account_id ?? '');
        setDefaultTaxLiability(data.default_tax_liability_account_id ?? '');
        setDefaultFxGainLoss(data.default_fx_gain_loss_account_id ?? '');
      }
      if (accountsRes.ok) {
        const { data } = await accountsRes.json();
        setAccounts(data);
      }
      if (taxRes.ok) {
        const { data } = await taxRes.json();
        setTaxRates(data);
      }
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/accounting/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_payment_terms: parseInt(paymentTerms, 10) || 30,
          invoice_notes: invoiceNotes || null,
          invoice_footer: invoiceFooter || null,
          default_revenue_account_id: defaultRevenue || null,
          default_expense_account_id: defaultExpense || null,
          default_ar_account_id: defaultAR || null,
          default_ap_account_id: defaultAP || null,
          default_cash_account_id: defaultCash || null,
          default_tax_liability_account_id: defaultTaxLiability || null,
          default_fx_gain_loss_account_id: defaultFxGainLoss || null,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }

      toast.success('Settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const openTaxForm = (tax?: TaxRate) => {
    if (tax) {
      setEditingTax(tax);
      setTaxName(tax.name);
      setTaxRateValue(String(Number(tax.rate) * 100));
      setTaxDescription(tax.description ?? '');
      setTaxIsDefault(tax.is_default ?? false);
    } else {
      setEditingTax(null);
      setTaxName('');
      setTaxRateValue('');
      setTaxDescription('');
      setTaxIsDefault(false);
    }
    setTaxFormOpen(true);
  };

  const handleSaveTax = async () => {
    const rateDecimal = (parseFloat(taxRateValue) || 0) / 100;

    try {
      const url = editingTax ? `/api/accounting/tax-rates/${editingTax.id}` : '/api/accounting/tax-rates';
      const method = editingTax ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: taxName.trim(),
          rate: rateDecimal,
          description: taxDescription.trim() || undefined,
          is_default: taxIsDefault,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }

      toast.success(editingTax ? 'Tax rate updated' : 'Tax rate created');
      setTaxFormOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save tax rate');
    }
  };

  const handleDeleteTax = async (id: string) => {
    try {
      const response = await fetch(`/api/accounting/tax-rates/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      toast.success('Tax rate deactivated');
      fetchData();
    } catch {
      toast.error('Failed to delete tax rate');
    }
  };

  const accountSelect = (value: string, onChange: (v: string) => void, filterType?: string) => (
    <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
      <SelectTrigger>
        <SelectValue placeholder="Select account" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">None</SelectItem>
        {accounts
          .filter((a) => {
            if (filterType && a.account_type !== filterType) {
              return false;
            }
            return a.is_active || a.id === value;
          })
          .map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.account_code} - {a.name}{!a.is_active ? ' (Inactive)' : ''}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );

  if (isLoading) {
    return <div className="text-muted-foreground text-center py-12">Loading settings...</div>;
  }

  if (!settings) {
    return <div className="text-muted-foreground text-center py-12">No settings found</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="defaults">Default Accounts</TabsTrigger>
          <TabsTrigger value="tax">Tax Rates</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <div className="max-w-lg space-y-4">
            <div className="space-y-2">
              <Label>Default Payment Terms (days)</Label>
              <Input
                type="number"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                min={0}
                max={365}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Invoice Notes</Label>
              <Textarea
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                placeholder="Notes that appear on every invoice"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Invoice Footer</Label>
              <Textarea
                value={invoiceFooter}
                onChange={(e) => setInvoiceFooter(e.target.value)}
                placeholder="Footer text for invoices"
                rows={2}
              />
            </div>
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </TabsContent>

        {/* Default Accounts */}
        <TabsContent value="defaults" className="space-y-4 mt-4">
          <div className="max-w-lg space-y-4">
            <div className="space-y-2">
              <Label>Default Revenue Account</Label>
              {accountSelect(defaultRevenue, setDefaultRevenue, 'revenue')}
            </div>
            <div className="space-y-2">
              <Label>Default Expense Account</Label>
              {accountSelect(defaultExpense, setDefaultExpense, 'expense')}
            </div>
            <div className="space-y-2">
              <Label>Accounts Receivable</Label>
              {accountSelect(defaultAR, setDefaultAR, 'asset')}
            </div>
            <div className="space-y-2">
              <Label>Accounts Payable</Label>
              {accountSelect(defaultAP, setDefaultAP, 'liability')}
            </div>
            <div className="space-y-2">
              <Label>Cash Account</Label>
              {accountSelect(defaultCash, setDefaultCash, 'asset')}
            </div>
            <div className="space-y-2">
              <Label>Tax Liability Account</Label>
              {accountSelect(defaultTaxLiability, setDefaultTaxLiability, 'liability')}
            </div>
            <div className="space-y-2">
              <Label>FX Gain/Loss Account</Label>
              {accountSelect(defaultFxGainLoss, setDefaultFxGainLoss)}
            </div>
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Defaults'}
            </Button>
          </div>
        </TabsContent>

        {/* Tax Rates */}
        <TabsContent value="tax" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Manage tax rates used on invoices and bills.</p>
            <Button onClick={() => openTaxForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Tax Rate
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[100px]">Rate</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[80px]">Default</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxRates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No tax rates configured
                    </TableCell>
                  </TableRow>
                ) : (
                  taxRates.map((tax) => (
                    <TableRow key={tax.id}>
                      <TableCell className="font-medium">{tax.name}</TableCell>
                      <TableCell className="font-mono">{(Number(tax.rate) * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-muted-foreground">{tax.description || '—'}</TableCell>
                      <TableCell>
                        {tax.is_default && <Badge variant="secondary">Default</Badge>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tax.is_active ? 'outline' : 'secondary'}>
                          {tax.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openTaxForm(tax)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {tax.is_active && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDeleteTax(tax.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Tax Rate Dialog */}
      <Dialog open={taxFormOpen} onOpenChange={(open) => { setTaxFormOpen(open); if (!open) setEditingTax(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTax ? 'Edit Tax Rate' : 'Add Tax Rate'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Standard, Reduced, Exempt"
                value={taxName}
                onChange={(e) => setTaxName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g. 8.25"
                value={taxRateValue}
                onChange={(e) => setTaxRateValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                value={taxDescription}
                onChange={(e) => setTaxDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={taxIsDefault} onCheckedChange={setTaxIsDefault} />
              <Label>Default tax rate</Label>
            </div>
            <Button className="w-full" onClick={handleSaveTax} disabled={!taxName.trim()}>
              {editingTax ? 'Update' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
