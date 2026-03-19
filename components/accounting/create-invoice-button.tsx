'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface CreateInvoiceFromOpportunityProps {
  type: 'opportunity';
  opportunityId: string;
  opportunityName: string;
  amount: number | null;
  currency: string | null;
}

interface CreateInvoiceFromContractProps {
  type: 'contract';
  contractId: string;
  projectSlug: string;
  contractTitle: string;
}

type CreateInvoiceButtonProps =
  | CreateInvoiceFromOpportunityProps
  | CreateInvoiceFromContractProps;

export function CreateInvoiceButton(props: CreateInvoiceButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(
    props.type === 'opportunity' ? String(props.amount ?? '') : '',
  );
  const [description, setDescription] = useState(
    props.type === 'contract' ? props.contractTitle : '',
  );
  const opportunityHasAmount = props.type !== 'opportunity' || (props.amount !== null && props.amount > 0);
  const opportunityAmountLabel = props.type === 'opportunity' && props.amount !== null
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: props.currency || 'USD',
        minimumFractionDigits: 2,
      }).format(props.amount)
    : null;

  const handleCreate = async () => {
    setLoading(true);
    try {
      let res: Response;

      if (props.type === 'opportunity') {
        if (!opportunityHasAmount) {
          toast.error('Opportunity must have a positive amount before creating an invoice');
          setLoading(false);
          return;
        }
        res = await fetch('/api/accounting/invoices/from-opportunity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            opportunity_id: props.opportunityId,
          }),
        });
      } else {
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) {
          toast.error('Please enter a valid amount');
          setLoading(false);
          return;
        }
        res = await fetch('/api/accounting/invoices/from-contract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contract_id: props.contractId,
            project_slug: props.projectSlug,
            amount: amt,
            description,
          }),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to create invoice');
        return;
      }

      const { data } = await res.json();
      toast.success('Draft invoice created');
      setOpen(false);
      router.push(`/accounting/invoices/${data.invoice_id}`);
    } catch {
      toast.error('Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        size="sm"
        disabled={!opportunityHasAmount}
        title={!opportunityHasAmount ? 'Opportunity needs a positive amount before invoicing' : undefined}
      >
        <Receipt className="mr-2 h-4 w-4" />
        Create Invoice
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>
              {props.type === 'opportunity'
                ? `Create a draft invoice from opportunity "${props.opportunityName}"`
                : `Create a draft invoice from contract "${props.contractTitle}"`}
            </DialogDescription>
          </DialogHeader>

          {props.type === 'contract' && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Invoice line item description"
                />
              </div>
            </div>
          )}

          {props.type === 'opportunity' && props.amount !== null && (
            <p className="text-sm text-muted-foreground py-2">
              Invoice amount: {opportunityAmountLabel}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? 'Creating...' : 'Create Draft Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
