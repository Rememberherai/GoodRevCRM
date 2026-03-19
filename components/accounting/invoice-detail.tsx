'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Ban, DollarSign, Pencil } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { PaymentForm } from './payment-form';
import type { Database } from '@/types/database';

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_amount: number;
  sort_order: number;
  tax_rates: { id: string; name: string; rate: number } | null;
  chart_of_accounts: { id: string; account_code: string; name: string } | null;
}

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

interface TaxSummary {
  id: string;
  tax_name: string;
  tax_rate: number;
  taxable_amount: number;
  tax_amount: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  currency: string;
  customer_name: string;
  customer_email: string | null;
  customer_address: string | null;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  journal_entry_id: string | null;
  sent_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  created_at: string;
  invoice_line_items: InvoiceLineItem[];
  invoice_tax_summary: TaxSummary[];
  payments: Payment[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  partially_paid: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  voided: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  written_off: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

interface InvoiceDetailProps {
  invoiceId: string;
  role: Database['public']['Enums']['accounting_role'];
}

export function InvoiceDetail({ invoiceId, role }: InvoiceDetailProps) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [isActioning, setIsActioning] = useState(false);

  const fetchInvoice = useCallback(async () => {
    try {
      const response = await fetch(`/api/accounting/invoices/${invoiceId}`);
      if (!response.ok) throw new Error('Not found');
      const { data } = await response.json();
      setInvoice(data);
    } catch {
      toast.error('Failed to load invoice');
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handleSend = async () => {
    setIsActioning(true);
    try {
      const response = await fetch(`/api/accounting/invoices/${invoiceId}/send`, {
        method: 'POST',
      });
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }
      toast.success('Invoice sent — journal entry created');
      fetchInvoice();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send');
    } finally {
      setIsActioning(false);
      setShowSendConfirm(false);
    }
  };

  const handleVoid = async () => {
    setIsActioning(true);
    try {
      const response = await fetch(`/api/accounting/invoices/${invoiceId}/void`, {
        method: 'POST',
      });
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }
      toast.success('Invoice voided');
      fetchInvoice();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to void');
    } finally {
      setIsActioning(false);
      setShowVoidConfirm(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice?.currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  if (isLoading) {
    return <div className="text-muted-foreground text-center py-12">Loading...</div>;
  }

  if (!invoice) {
    return <div className="text-muted-foreground text-center py-12">Invoice not found</div>;
  }

  const canEdit = role !== 'viewer' && invoice.status === 'draft';
  const canSend = role !== 'viewer' && invoice.status === 'draft';
  const canVoid = (role === 'admin' || role === 'owner') && ['sent', 'overdue'].includes(invoice.status);
  const canPayment = role !== 'viewer' && ['sent', 'partially_paid', 'overdue'].includes(invoice.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/accounting/invoices')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
            <p className="text-muted-foreground text-sm">{invoice.customer_name}</p>
          </div>
          <Badge variant="secondary" className={STATUS_COLORS[invoice.status]}>
            {invoice.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => router.push(`/accounting/invoices/${invoiceId}/edit`)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {canSend && (
            <Button onClick={() => setShowSendConfirm(true)} disabled={isActioning}>
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          )}
          {canPayment && (
            <Button variant="outline" onClick={() => setShowPaymentForm(true)} disabled={isActioning}>
              <DollarSign className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          )}
          {canVoid && (
            <Button variant="destructive" onClick={() => setShowVoidConfirm(true)} disabled={isActioning}>
              <Ban className="h-4 w-4 mr-2" />
              Void
            </Button>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Invoice Date</p>
          <p className="font-medium">{invoice.invoice_date}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Due Date</p>
          <p className="font-medium">{invoice.due_date}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Email</p>
          <p className="font-medium">{invoice.customer_email || '—'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Address</p>
          <p className="font-medium">{invoice.customer_address || '—'}</p>
        </div>
        {invoice.notes && (
          <div className="col-span-2">
            <p className="text-sm text-muted-foreground">Notes</p>
            <p className="font-medium">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right w-[80px]">Qty</TableHead>
              <TableHead className="text-right w-[120px]">Unit Price</TableHead>
              <TableHead className="text-right w-[120px]">Amount</TableHead>
              <TableHead className="text-right w-[100px]">Tax</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.invoice_line_items
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-medium">{line.description}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {line.chart_of_accounts
                      ? `${line.chart_of_accounts.account_code} - ${line.chart_of_accounts.name}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono">{Number(line.quantity)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(Number(line.unit_price))}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(Number(line.amount))}</TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(line.tax_amount) > 0
                      ? `${formatCurrency(Number(line.tax_amount))}${line.tax_rates ? ` (${line.tax_rates.name})` : ''}`
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            {/* Totals */}
            <TableRow className="bg-muted/50">
              <TableCell colSpan={4} className="text-right font-medium">Subtotal</TableCell>
              <TableCell className="text-right font-mono font-medium">{formatCurrency(Number(invoice.subtotal))}</TableCell>
              <TableCell />
            </TableRow>
            {Number(invoice.tax_total) > 0 && (
              <TableRow className="bg-muted/50">
                <TableCell colSpan={4} className="text-right font-medium">Tax</TableCell>
                <TableCell className="text-right font-mono font-medium">{formatCurrency(Number(invoice.tax_total))}</TableCell>
                <TableCell />
              </TableRow>
            )}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell colSpan={4} className="text-right">Total</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(Number(invoice.total))}</TableCell>
              <TableCell />
            </TableRow>
            {Number(invoice.amount_paid) > 0 && (
              <>
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={4} className="text-right font-medium">Paid</TableCell>
                  <TableCell className="text-right font-mono font-medium text-green-600">
                    -{formatCurrency(Number(invoice.amount_paid))}
                  </TableCell>
                  <TableCell />
                </TableRow>
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={4} className="text-right">Balance Due</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(Number(invoice.balance_due))}</TableCell>
                  <TableCell />
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Tax Summary */}
      {invoice.invoice_tax_summary.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Tax Summary</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tax</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">Tax Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.invoice_tax_summary.map((ts) => (
                  <TableRow key={ts.id}>
                    <TableCell>{ts.tax_name}</TableCell>
                    <TableCell className="text-right">{(Number(ts.tax_rate) * 100).toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(Number(ts.taxable_amount))}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(Number(ts.tax_amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Payments */}
      {invoice.payments.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Payment History</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.payment_date}</TableCell>
                    <TableCell>{p.payment_method || '—'}</TableCell>
                    <TableCell>{p.reference || '—'}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(Number(p.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Send Confirmation */}
      <AlertDialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send invoice {invoice.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will finalize the invoice and create the accounting journal entry
              (debit AR, credit revenue). The invoice can no longer be edited after sending.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={isActioning}>
              {isActioning ? 'Sending...' : 'Send'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void Confirmation */}
      <AlertDialog open={showVoidConfirm} onOpenChange={setShowVoidConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void invoice {invoice.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will void the invoice and its associated journal entry by creating a reversing entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} disabled={isActioning}>
              {isActioning ? 'Voiding...' : 'Void'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Form */}
      {showPaymentForm && (
        <PaymentForm
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoice_number}
          balanceDue={Number(invoice.balance_due)}
          currency={invoice.currency}
          open={showPaymentForm}
          onClose={() => setShowPaymentForm(false)}
          onSuccess={() => {
            setShowPaymentForm(false);
            fetchInvoice();
          }}
        />
      )}
    </div>
  );
}
