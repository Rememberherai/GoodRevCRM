-- Migration 0107: Create void_invoice RPC
-- This function was defined in 0104 but not applied to the database.

CREATE OR REPLACE FUNCTION public.void_invoice(p_invoice_id UUID)
RETURNS UUID AS $$
DECLARE
    v_invoice RECORD;
    v_payment_count BIGINT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF v_invoice IS NULL THEN
        RAISE EXCEPTION 'Invoice not found';
    END IF;

    IF NOT public.has_accounting_role(v_invoice.company_id, 'admin') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    IF v_invoice.status NOT IN ('sent', 'overdue') THEN
        RAISE EXCEPTION 'Cannot void a % invoice', v_invoice.status;
    END IF;

    SELECT COUNT(*)
    INTO v_payment_count
    FROM public.payments
    WHERE invoice_id = p_invoice_id
      AND deleted_at IS NULL;

    IF v_payment_count > 0 THEN
        RAISE EXCEPTION 'Cannot void an invoice with payments';
    END IF;

    IF v_invoice.journal_entry_id IS NOT NULL THEN
        PERFORM public.void_journal_entry(v_invoice.journal_entry_id);
    END IF;

    UPDATE public.invoices
    SET status = 'voided',
        voided_at = NOW(),
        amount_paid = 0,
        balance_due = 0,
        paid_at = NULL
    WHERE id = p_invoice_id;

    RETURN p_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.void_invoice IS 'Voids a sent or overdue invoice with no payments and voids the associated journal entry in the same transaction.';
