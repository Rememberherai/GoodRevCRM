'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Check, Crown, Loader2, Plus, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '@/types/quote';
import type { QuoteWithLineItems, QuoteStatus } from '@/types/quote';
import { LineItemRow } from './line-item-row';

interface QuoteDetailProps {
  quoteId: string;
  opportunityStage: string;
  onBack: () => void;
  getQuote: (quoteId: string) => Promise<QuoteWithLineItems>;
  accept: (quoteId: string, syncAmount: boolean) => Promise<unknown>;
  reject: (quoteId: string) => Promise<void>;
  setPrimary: (quoteId: string) => Promise<void>;
  update: (quoteId: string, data: Record<string, unknown>) => Promise<unknown>;
  addLineItem: (quoteId: string, data: Record<string, unknown>) => Promise<unknown>;
  updateLineItem: (quoteId: string, itemId: string, data: Record<string, unknown>) => Promise<unknown>;
  deleteLineItem: (quoteId: string, itemId: string) => Promise<void>;
  onQuoteChanged: () => Promise<void> | void;
}

export function QuoteDetail({
  quoteId,
  opportunityStage,
  onBack,
  getQuote,
  accept,
  reject,
  setPrimary,
  update,
  addLineItem,
  updateLineItem,
  deleteLineItem,
  onQuoteChanged,
}: QuoteDetailProps) {
  const [quote, setQuote] = useState<QuoteWithLineItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [syncAmount, setSyncAmount] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isClosed = opportunityStage === 'closed_won' || opportunityStage === 'closed_lost';
  const isReadOnly = isClosed;

  const loadQuote = useCallback(async () => {
    try {
      const data = await getQuote(quoteId);
      setQuote(data);
    } catch {
      toast.error('Failed to load quote');
    } finally {
      setLoading(false);
    }
  }, [quoteId, getQuote]);

  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  const handleAction = async (action: string, fn: () => Promise<unknown>) => {
    setActionLoading(action);
    try {
      await fn();
      await loadQuote();
      await onQuoteChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccept = async () => {
    try {
      await handleAction('accept', () => accept(quoteId, syncAmount));
    } finally {
      setShowAcceptDialog(false);
    }
  };

  const handleAddLineItem = async () => {
    await handleAction('add item', () =>
      addLineItem(quoteId, { name: 'New item', quantity: 1, unit_price: 0, discount_percent: 0 })
    );
  };

  const handleUpdateLineItem = async (itemId: string, data: Record<string, unknown>) => {
    try {
      await updateLineItem(quoteId, itemId, data);
      await loadQuote();
      await onQuoteChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update line item');
    }
  };

  const handleDeleteLineItem = async (itemId: string) => {
    try {
      await deleteLineItem(quoteId, itemId);
      await loadQuote();
      await onQuoteChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete line item');
    }
  };

  const formatCurrency = (val: number | string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: quote?.currency ?? 'USD' }).format(
      Number(val)
    );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!quote) {
    return <p className="text-muted-foreground">Quote not found.</p>;
  }

  const canAccept = !isClosed && (quote.status === 'draft' || quote.status === 'sent');
  const canReject = !isClosed && !['accepted', 'rejected', 'expired'].includes(quote.status);
  const canSend = !isClosed && quote.status === 'draft';
  const canSetPrimary = !isClosed && !quote.is_primary && ['draft', 'sent', 'accepted'].includes(quote.status);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle>{quote.title}</CardTitle>
                {quote.is_primary && (
                  <Badge variant="outline" className="gap-1">
                    <Crown className="h-3 w-3" /> Primary
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {quote.quote_number && <span>{quote.quote_number}</span>}
                {quote.valid_until && <span>Valid until {quote.valid_until}</span>}
              </div>
            </div>
            <Badge className={QUOTE_STATUS_COLORS[quote.status as QuoteStatus]}>
              {QUOTE_STATUS_LABELS[quote.status as QuoteStatus]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!isReadOnly && (
            <div className="flex items-center gap-2 mb-4">
              {canSend && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!actionLoading}
                  onClick={() => handleAction('send', () => update(quoteId, { status: 'sent' }))}
                >
                  <Send className="mr-1 h-4 w-4" />
                  Mark as Sent
                </Button>
              )}
              {canAccept && (
                <Button
                  variant="default"
                  size="sm"
                  disabled={!!actionLoading}
                  onClick={() => setShowAcceptDialog(true)}
                >
                  <Check className="mr-1 h-4 w-4" />
                  Accept
                </Button>
              )}
              {canReject && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!actionLoading}
                  onClick={() => handleAction('reject', () => reject(quoteId))}
                >
                  <X className="mr-1 h-4 w-4" />
                  Reject
                </Button>
              )}
              {canSetPrimary && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!actionLoading}
                  onClick={() => handleAction('set primary', () => setPrimary(quoteId))}
                >
                  <Crown className="mr-1 h-4 w-4" />
                  Set Primary
                </Button>
              )}
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          )}

          {quote.notes && (
            <p className="text-sm text-muted-foreground mb-4">{quote.notes}</p>
          )}

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Item</TableHead>
                  <TableHead className="w-[100px]">Qty</TableHead>
                  <TableHead className="w-[120px]">Unit Price</TableHead>
                  <TableHead className="w-[90px]">Disc %</TableHead>
                  <TableHead className="w-[120px] text-right">Total</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.line_items.map((item) => (
                  <LineItemRow
                    key={`${item.id}:${item.updated_at}`}
                    item={item}
                    currency={quote.currency}
                    disabled={isReadOnly}
                    onUpdate={handleUpdateLineItem}
                    onDelete={handleDeleteLineItem}
                  />
                ))}
              </TableBody>
            </Table>

            {!isReadOnly && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddLineItem}
                  disabled={!!actionLoading}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Line Item
                </Button>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          <div className="flex justify-end">
            <div className="w-[260px] space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(quote.subtotal)}</span>
              </div>
              {Number(quote.discount_total) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">-{formatCurrency(quote.discount_total)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>{formatCurrency(quote.total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Accept &quot;{quote.title}&quot; for {formatCurrency(quote.total)}?
              This will auto-reject any other accepted quotes on this opportunity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 px-6 pb-2">
            <Checkbox
              id="sync-amount"
              checked={syncAmount}
              onCheckedChange={(checked) => setSyncAmount(checked === true)}
            />
            <Label htmlFor="sync-amount" className="text-sm">
              Update opportunity deal value to {formatCurrency(quote.total)}
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAccept} disabled={!!actionLoading}>
              {actionLoading === 'accept' ? 'Accepting…' : 'Accept Quote'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
