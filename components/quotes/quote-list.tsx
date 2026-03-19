'use client';

import { useState } from 'react';
import { Crown, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '@/types/quote';
import type { Quote, QuoteStatus, QuoteWithLineItems } from '@/types/quote';
import { QuoteForm } from './quote-form';
import { QuoteDetail } from './quote-detail';

interface QuoteListProps {
  opportunityStage: string;
  quotes: Quote[];
  isLoading: boolean;
  error: string | null;
  create: (data: Record<string, unknown>) => Promise<Quote>;
  update: (quoteId: string, data: Record<string, unknown>) => Promise<Quote>;
  remove: (quoteId: string) => Promise<void>;
  accept: (quoteId: string, syncAmount: boolean) => Promise<unknown>;
  reject: (quoteId: string) => Promise<void>;
  setPrimary: (quoteId: string) => Promise<void>;
  getQuote: (quoteId: string) => Promise<QuoteWithLineItems>;
  addLineItem: (quoteId: string, data: Record<string, unknown>) => Promise<unknown>;
  updateLineItem: (quoteId: string, itemId: string, data: Record<string, unknown>) => Promise<unknown>;
  deleteLineItem: (quoteId: string, itemId: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function QuoteList({
  opportunityStage,
  quotes,
  isLoading,
  error,
  create,
  update,
  remove,
  accept,
  reject,
  setPrimary,
  getQuote,
  addLineItem,
  updateLineItem,
  deleteLineItem,
  reload,
}: QuoteListProps) {
  const [showForm, setShowForm] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isClosed = opportunityStage === 'closed_won' || opportunityStage === 'closed_lost';

  const formatCurrency = (val: number | string, currency: string | null) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency ?? 'USD',
      minimumFractionDigits: 0,
    }).format(
      Number(val)
    );

  const handleDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await remove(deleteTarget.id);
      toast.success('Quote deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete quote');
    } finally {
      setIsDeleting(false);
    }
  };

  if (selectedQuoteId) {
    return (
      <QuoteDetail
        quoteId={selectedQuoteId}
        opportunityStage={opportunityStage}
        onBack={() => {
          setSelectedQuoteId(null);
          void reload();
        }}
        getQuote={getQuote}
        accept={accept}
        reject={reject}
        setPrimary={setPrimary}
        update={update}
        addLineItem={addLineItem}
        updateLineItem={updateLineItem}
        deleteLineItem={deleteLineItem}
        onQuoteChanged={reload}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Quotes ({quotes.length})</h3>
        {!isClosed && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-4 w-4" />
            New Quote
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
      )}

      {quotes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No quotes yet</p>
            {!isClosed && (
              <p className="text-sm mt-1">Create a quote to build an itemized proposal.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {quotes.map((quote) => (
            <Card
              key={quote.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedQuoteId(quote.id)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{quote.title}</span>
                        {quote.is_primary && (
                          <Badge variant="outline" className="gap-1 shrink-0">
                            <Crown className="h-3 w-3" /> Primary
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {quote.quote_number && <span>{quote.quote_number}</span>}
                        {quote.valid_until && <span>Valid until {quote.valid_until}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold">{formatCurrency(quote.total, quote.currency)}</span>
                    <Badge className={QUOTE_STATUS_COLORS[quote.status as QuoteStatus]}>
                      {QUOTE_STATUS_LABELS[quote.status as QuoteStatus]}
                    </Badge>
                    {!isClosed && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(quote);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <QuoteForm
        open={showForm}
        onOpenChange={setShowForm}
        onSave={create}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteTarget?.title}&quot;? This will also remove all line items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
