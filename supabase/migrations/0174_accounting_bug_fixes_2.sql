-- Migration 0174: Accounting bug fixes (batch 2)
--
-- BUG-D: create_invoice has no service-role path.
--   add p_created_by UUID DEFAULT NULL, mirror the create_bill pattern.
--
-- BUG-E: void_journal_entry uses auth.uid() for created_by — FK violation
--   when called from service role (auth.uid() is NULL).
--   Fix: accept optional p_calling_user, use COALESCE.

-- ============================================================
-- BUG-D: Add service-role support to create_invoice
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_invoice(
    p_company_id UUID,
    p_customer_name TEXT,
    p_invoice_date DATE,
    p_due_date DATE,
    p_lines JSONB,
    p_customer_email TEXT DEFAULT NULL,
    p_customer_address TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_organization_id UUID DEFAULT NULL,
    p_contact_id UUID DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_currency TEXT DEFAULT 'USD',
    p_exchange_rate DECIMAL DEFAULT 1.0,
    p_notes TEXT DEFAULT NULL,
    p_footer TEXT DEFAULT NULL,
    p_payment_terms INTEGER DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_invoice_id UUID;
    v_invoice_number TEXT;
    v_actor_id UUID;
BEGIN
    v_actor_id := COALESCE(auth.uid(), p_created_by);

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Skip role check when called from service role (auth.uid() is NULL)
    IF auth.uid() IS NOT NULL AND NOT public.has_accounting_role(p_company_id, 'member') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    IF jsonb_typeof(p_lines) != 'array' OR jsonb_array_length(p_lines) < 1 THEN
        RAISE EXCEPTION 'At least 1 line item is required';
    END IF;

    IF p_due_date < p_invoice_date THEN
        RAISE EXCEPTION 'Due date cannot be before invoice date';
    END IF;

    v_invoice_number := public.allocate_invoice_number(p_company_id);

    INSERT INTO public.invoices (
        company_id, invoice_number, customer_name, customer_email,
        customer_address, customer_phone, organization_id, contact_id,
        project_id, invoice_date, due_date, payment_terms,
        currency, exchange_rate, notes, footer, created_by
    )
    VALUES (
        p_company_id, v_invoice_number, p_customer_name, p_customer_email,
        p_customer_address, p_customer_phone, p_organization_id, p_contact_id,
        p_project_id, p_invoice_date, p_due_date, p_payment_terms,
        p_currency, p_exchange_rate, p_notes, p_footer, v_actor_id
    )
    RETURNING id INTO v_invoice_id;

    INSERT INTO public.invoice_line_items (
        invoice_id, description, quantity, unit_price,
        account_id, tax_rate_id, sort_order
    )
    SELECT
        v_invoice_id,
        line->>'description',
        COALESCE((line->>'quantity')::DECIMAL(15,4), 1),
        (line->>'unit_price')::DECIMAL(15,4),
        (line->>'account_id')::UUID,
        CASE WHEN NULLIF(line->>'tax_rate_id', '') IS NULL THEN NULL
             ELSE (line->>'tax_rate_id')::UUID END,
        COALESCE((line->>'sort_order')::INTEGER, idx - 1)
    FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS t(line, idx);

    RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- BUG-E: Guard void_journal_entry against NULL auth.uid()
--   (service-role callers would cause FK violation on created_by)
-- ============================================================
CREATE OR REPLACE FUNCTION public.void_journal_entry(
    p_entry_id UUID,
    p_calling_user UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    original RECORD;
    reversal_id UUID;
    reversal_number INTEGER;
    calling_user UUID;
BEGIN
    calling_user := COALESCE(auth.uid(), p_calling_user);

    IF calling_user IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Lock and fetch the original entry
    SELECT * INTO original
    FROM public.journal_entries
    WHERE id = p_entry_id
    FOR UPDATE;

    IF original IS NULL THEN
        RAISE EXCEPTION 'Journal entry not found: %', p_entry_id;
    END IF;

    -- Verify the calling user has access to this company
    -- Skip role check when called from service role (auth.uid() is NULL)
    IF auth.uid() IS NOT NULL AND NOT public.has_accounting_role(original.company_id, 'admin') THEN
        RAISE EXCEPTION 'Insufficient permissions to void this journal entry';
    END IF;

    IF original.status != 'posted' THEN
        RAISE EXCEPTION 'Can only void posted journal entries (current status: %)', original.status;
    END IF;

    -- Allocate a new entry number
    reversal_number := public.allocate_je_number(original.company_id);

    -- Create the reversing entry (directly posted)
    INSERT INTO public.journal_entries (
        company_id, entry_number, entry_date, memo, reference,
        source_type, source_id, status, project_id,
        posted_at, created_by
    )
    VALUES (
        original.company_id,
        reversal_number,
        CURRENT_DATE,
        'Reversal of JE-' || original.entry_number || ': ' || COALESCE(original.memo, ''),
        original.reference,
        'reversal',
        original.id,
        'draft',  -- Start as draft, we'll post after adding lines
        original.project_id,
        NULL,
        calling_user
    )
    RETURNING id INTO reversal_id;

    -- Copy lines with debits and credits swapped
    INSERT INTO public.journal_entry_lines (
        journal_entry_id, account_id, description,
        debit, credit, currency, exchange_rate,
        base_debit, base_credit, organization_id
    )
    SELECT
        reversal_id, account_id,
        'Reversal: ' || COALESCE(description, ''),
        credit, debit,  -- Swap debit and credit
        currency, exchange_rate,
        base_credit, base_debit,  -- Swap base amounts too
        organization_id
    FROM public.journal_entry_lines
    WHERE journal_entry_id = p_entry_id;

    -- Post the reversal entry (triggers will validate balance)
    UPDATE public.journal_entries
    SET status = 'posted'
    WHERE id = reversal_id;

    -- Void the original entry
    UPDATE public.journal_entries
    SET status = 'voided',
        voided_at = NOW(),
        voided_by_entry_id = reversal_id
    WHERE id = p_entry_id;

    RETURN reversal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
