-- Migration 0105: Invoice bugfixes from code review
-- Fixes issues found during Phase 2 bug sweep.

-- Fix 1: Restrict invoice UPDATE to draft only via RLS.
-- Prevents direct PostgREST updates to sent/paid invoices.
DROP POLICY IF EXISTS "Members can update draft invoices" ON public.invoices;
CREATE POLICY "Members can update draft invoices"
    ON public.invoices
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND status = 'draft'
        AND public.has_accounting_role(company_id, 'member')
    )
    WITH CHECK (
        deleted_at IS NULL
        AND status = 'draft'
        AND public.has_accounting_role(company_id, 'member')
    );

-- send_invoice, record_invoice_payment, and void_invoice are RPCs,
-- so we do not need a broad admin UPDATE policy on invoices.
DROP POLICY IF EXISTS "Admins can update invoice status" ON public.invoices;

-- Fix 2: Add explicit WITH CHECK to invoice_tax_summary FOR ALL policy.
DROP POLICY IF EXISTS "Members can manage invoice tax summary" ON public.invoice_tax_summary;
CREATE POLICY "Members can manage invoice tax summary"
    ON public.invoice_tax_summary FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id
        AND public.has_accounting_role(i.company_id, 'member')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id
        AND public.has_accounting_role(i.company_id, 'member')
    ));

-- Fix 3: Drop unused discount_amount column.
-- Not implemented in any logic; if set, it would cause JE imbalance.
-- Will re-add properly when discount feature is built.
ALTER TABLE public.invoices DROP COLUMN IF EXISTS discount_amount;

-- Fix 4: Add update_draft_invoice RPC for atomic line replacement.
CREATE OR REPLACE FUNCTION public.update_draft_invoice(
    p_invoice_id UUID,
    p_patch JSONB DEFAULT '{}'::JSONB,
    p_lines JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_invoice public.invoices%ROWTYPE;
    v_invoice_date DATE;
    v_due_date DATE;
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

    IF v_invoice.status != 'draft' THEN
        RAISE EXCEPTION 'Can only edit draft invoices';
    END IF;

    IF NOT public.has_accounting_role(v_invoice.company_id, 'member') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    v_invoice_date := COALESCE(
        CASE WHEN p_patch ? 'invoice_date' THEN (p_patch->>'invoice_date')::DATE END,
        v_invoice.invoice_date
    );
    v_due_date := COALESCE(
        CASE WHEN p_patch ? 'due_date' THEN (p_patch->>'due_date')::DATE END,
        v_invoice.due_date
    );

    IF v_due_date < v_invoice_date THEN
        RAISE EXCEPTION 'Due date cannot be before invoice date';
    END IF;

    UPDATE public.invoices
    SET customer_name = CASE WHEN p_patch ? 'customer_name' THEN p_patch->>'customer_name' ELSE customer_name END,
        customer_email = CASE WHEN p_patch ? 'customer_email' THEN NULLIF(p_patch->>'customer_email', '') ELSE customer_email END,
        customer_address = CASE WHEN p_patch ? 'customer_address' THEN NULLIF(p_patch->>'customer_address', '') ELSE customer_address END,
        customer_phone = CASE WHEN p_patch ? 'customer_phone' THEN NULLIF(p_patch->>'customer_phone', '') ELSE customer_phone END,
        organization_id = CASE WHEN p_patch ? 'organization_id' THEN NULLIF(p_patch->>'organization_id', '')::UUID ELSE organization_id END,
        contact_id = CASE WHEN p_patch ? 'contact_id' THEN NULLIF(p_patch->>'contact_id', '')::UUID ELSE contact_id END,
        project_id = CASE WHEN p_patch ? 'project_id' THEN NULLIF(p_patch->>'project_id', '')::UUID ELSE project_id END,
        invoice_date = v_invoice_date,
        due_date = v_due_date,
        payment_terms = CASE WHEN p_patch ? 'payment_terms' THEN (p_patch->>'payment_terms')::INTEGER ELSE payment_terms END,
        currency = CASE WHEN p_patch ? 'currency' THEN p_patch->>'currency' ELSE currency END,
        exchange_rate = CASE WHEN p_patch ? 'exchange_rate' THEN (p_patch->>'exchange_rate')::DECIMAL ELSE exchange_rate END,
        notes = CASE WHEN p_patch ? 'notes' THEN NULLIF(p_patch->>'notes', '') ELSE notes END,
        footer = CASE WHEN p_patch ? 'footer' THEN NULLIF(p_patch->>'footer', '') ELSE footer END
    WHERE id = p_invoice_id;

    IF p_lines IS NOT NULL THEN
        IF jsonb_typeof(p_lines) != 'array' OR jsonb_array_length(p_lines) < 1 THEN
            RAISE EXCEPTION 'At least 1 line item is required';
        END IF;

        DELETE FROM public.invoice_line_items WHERE invoice_id = p_invoice_id;

        INSERT INTO public.invoice_line_items (
            invoice_id, description, quantity, unit_price,
            account_id, tax_rate_id, sort_order
        )
        SELECT
            p_invoice_id,
            line->>'description',
            COALESCE((line->>'quantity')::DECIMAL(15,4), 1),
            (line->>'unit_price')::DECIMAL(15,4),
            (line->>'account_id')::UUID,
            CASE WHEN NULLIF(line->>'tax_rate_id', '') IS NULL THEN NULL
                 ELSE (line->>'tax_rate_id')::UUID END,
            COALESCE((line->>'sort_order')::INTEGER, idx - 1)
        FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS t(line, idx);
    END IF;

    RETURN p_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

COMMENT ON FUNCTION public.update_draft_invoice IS 'Atomically updates a draft invoice header and optionally replaces line items.';

-- Fix 5: Add missing index for payment lookups by invoice_id.
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id) WHERE deleted_at IS NULL;
