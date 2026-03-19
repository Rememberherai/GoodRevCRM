-- Migration 0104: Invoices, Invoice Line Items, Tax Summary, and Payments
-- Phase 2: Accounts Receivable — invoicing and payment collection.

-- ============================================================
-- Invoices
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.accounting_companies(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'voided', 'written_off')),

    -- Immutable customer snapshot (survives CRM changes)
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_address TEXT,
    customer_phone TEXT,

    -- Optional CRM navigation references (no strict FK enforcement for cross-scope)
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
    opportunity_id UUID,
    contract_id UUID,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    payment_terms INTEGER,
    currency TEXT NOT NULL DEFAULT 'USD',
    exchange_rate DECIMAL(15,6) NOT NULL DEFAULT 1.0,

    -- Totals (recomputed by trigger on line item changes)
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    total DECIMAL(15,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
    balance_due DECIMAL(15,2) NOT NULL DEFAULT 0,

    notes TEXT,
    footer TEXT,

    -- Auto-JE reference (created on send)
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,

    sent_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,

    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT unique_invoice_number_per_company UNIQUE (company_id, invoice_number)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(company_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON public.invoices(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON public.invoices(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_journal_entry_id ON public.invoices(journal_entry_id) WHERE journal_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON public.invoices(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- Invoice Line Items
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,4) NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
    tax_rate_id UUID REFERENCES public.tax_rates(id) ON DELETE SET NULL,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON public.invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_account_id ON public.invoice_line_items(account_id);

-- ============================================================
-- Invoice Tax Summary (populated at send time)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoice_tax_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    tax_rate_id UUID NOT NULL REFERENCES public.tax_rates(id) ON DELETE RESTRICT,
    tax_name TEXT NOT NULL,
    tax_rate DECIMAL(5,4) NOT NULL,
    taxable_amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.invoice_tax_summary ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_invoice_tax_summary_invoice_id ON public.invoice_tax_summary(invoice_id);

-- ============================================================
-- Payments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.accounting_companies(id) ON DELETE CASCADE,
    payment_type TEXT NOT NULL DEFAULT 'received'
        CHECK (payment_type IN ('received', 'sent')),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    -- bill_id added in Phase 4
    organization_id UUID,
    payment_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    exchange_rate DECIMAL(15,6) NOT NULL DEFAULT 1.0,
    payment_method TEXT CHECK (payment_method IN ('cash', 'check', 'credit_card', 'bank_transfer', 'ach', 'wire', 'other')),
    reference TEXT,
    account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
    notes TEXT,
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_payments_company_id ON public.payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(company_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON public.payments(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- RLS Policies — Invoices
-- ============================================================

CREATE POLICY "Members can view invoices"
    ON public.invoices FOR SELECT
    USING (deleted_at IS NULL AND public.is_accounting_member(company_id));

CREATE POLICY "Members can create invoices"
    ON public.invoices FOR INSERT
    WITH CHECK (public.has_accounting_role(company_id, 'member'));

CREATE POLICY "Members can update draft invoices"
    ON public.invoices FOR UPDATE
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

CREATE POLICY "Admins can delete draft invoices"
    ON public.invoices FOR DELETE
    USING (
        public.has_accounting_role(company_id, 'admin')
        AND status = 'draft'
    );

-- ============================================================
-- RLS Policies — Invoice Line Items (via parent invoice)
-- ============================================================

CREATE POLICY "Members can view invoice line items"
    ON public.invoice_line_items FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id AND i.deleted_at IS NULL
        AND public.is_accounting_member(i.company_id)
    ));

CREATE POLICY "Members can create invoice line items"
    ON public.invoice_line_items FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id AND i.status = 'draft'
        AND public.has_accounting_role(i.company_id, 'member')
    ));

CREATE POLICY "Members can update draft invoice line items"
    ON public.invoice_line_items FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id AND i.status = 'draft'
        AND public.has_accounting_role(i.company_id, 'member')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id AND i.status = 'draft'
        AND public.has_accounting_role(i.company_id, 'member')
    ));

CREATE POLICY "Members can delete draft invoice line items"
    ON public.invoice_line_items FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id AND i.status = 'draft'
        AND public.has_accounting_role(i.company_id, 'member')
    ));

-- ============================================================
-- RLS Policies — Invoice Tax Summary (via parent invoice)
-- ============================================================

CREATE POLICY "Members can view invoice tax summary"
    ON public.invoice_tax_summary FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id AND i.deleted_at IS NULL
        AND public.is_accounting_member(i.company_id)
    ));

CREATE POLICY "Members can view payments"
    ON public.payments FOR SELECT
    USING (deleted_at IS NULL AND public.is_accounting_member(company_id));

-- ============================================================
-- Trigger: Compute line item amount and tax
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_invoice_line_amounts()
RETURNS TRIGGER AS $$
DECLARE
    v_rate DECIMAL(5,4);
BEGIN
    NEW.amount := ROUND(NEW.quantity * NEW.unit_price, 2);

    IF NEW.tax_rate_id IS NOT NULL THEN
        SELECT rate INTO v_rate FROM public.tax_rates WHERE id = NEW.tax_rate_id;
        NEW.tax_amount := ROUND(NEW.amount * COALESCE(v_rate, 0), 2);
    ELSE
        NEW.tax_amount := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER compute_invoice_line_amounts_trigger
    BEFORE INSERT OR UPDATE ON public.invoice_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.compute_invoice_line_amounts();

-- ============================================================
-- Trigger: Validate invoice line item references
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_invoice_line_item_references()
RETURNS TRIGGER AS $$
DECLARE
    v_company_id UUID;
BEGIN
    SELECT company_id
    INTO v_company_id
    FROM public.invoices
    WHERE id = NEW.invoice_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Invoice not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.chart_of_accounts
        WHERE id = NEW.account_id
          AND company_id = v_company_id
          AND account_type = 'revenue'
          AND deleted_at IS NULL
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Invoice line account must be an active revenue account in this company';
    END IF;

    IF NEW.tax_rate_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.tax_rates
        WHERE id = NEW.tax_rate_id
          AND company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'Invoice tax rate must belong to this company';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_invoice_line_item_references_trigger
    BEFORE INSERT OR UPDATE ON public.invoice_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_invoice_line_item_references();

-- ============================================================
-- Trigger: Recompute invoice totals on line item changes
-- ============================================================

CREATE OR REPLACE FUNCTION public.recompute_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id UUID;
    v_subtotal DECIMAL(15,2);
    v_tax_total DECIMAL(15,2);
    v_total DECIMAL(15,2);
    v_amount_paid DECIMAL(15,2);
BEGIN
    v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

    SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(tax_amount), 0)
    INTO v_subtotal, v_tax_total
    FROM public.invoice_line_items
    WHERE invoice_id = v_invoice_id;

    v_total := v_subtotal + v_tax_total;

    SELECT amount_paid INTO v_amount_paid
    FROM public.invoices
    WHERE id = v_invoice_id;

    UPDATE public.invoices
    SET subtotal = v_subtotal,
        tax_total = v_tax_total,
        total = v_total,
        balance_due = v_total - COALESCE(v_amount_paid, 0)
    WHERE id = v_invoice_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recompute_invoice_totals_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.recompute_invoice_totals();

-- ============================================================
-- RPC: Create invoice atomically (header + lines)
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
    p_payment_terms INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_invoice_id UUID;
    v_invoice_number TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT public.has_accounting_role(p_company_id, 'member') THEN
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
        p_currency, p_exchange_rate, p_notes, p_footer, auth.uid()
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
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ============================================================
-- RPC: Update draft invoice atomically (header + lines)
-- ============================================================

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

    SELECT *
    INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
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

        DELETE FROM public.invoice_line_items
        WHERE invoice_id = p_invoice_id;

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
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ============================================================
-- RPC: Send invoice (finalize, create auto-JE, post it)
-- ============================================================

CREATE OR REPLACE FUNCTION public.send_invoice(p_invoice_id UUID)
RETURNS UUID AS $$
DECLARE
    v_invoice RECORD;
    v_settings RECORD;
    v_je_id UUID;
    v_je_number INTEGER;
    v_line RECORD;
    v_tax_summary RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Lock and fetch the invoice
    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF v_invoice IS NULL THEN
        RAISE EXCEPTION 'Invoice not found';
    END IF;

    IF v_invoice.status != 'draft' THEN
        RAISE EXCEPTION 'Can only send draft invoices (current status: %)', v_invoice.status;
    END IF;

    IF NOT public.has_accounting_role(v_invoice.company_id, 'member') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    -- Fetch settings for default accounts
    SELECT * INTO v_settings
    FROM public.accounting_settings
    WHERE company_id = v_invoice.company_id;

    IF v_settings IS NULL OR v_settings.default_ar_account_id IS NULL THEN
        RAISE EXCEPTION 'Default AR account must be configured in accounting settings';
    END IF;

    -- Verify invoice has line items and a positive total
    IF v_invoice.total <= 0 THEN
        RAISE EXCEPTION 'Invoice total must be positive';
    END IF;

    -- Populate invoice_tax_summary from line items
    DELETE FROM public.invoice_tax_summary WHERE invoice_id = p_invoice_id;

    INSERT INTO public.invoice_tax_summary (invoice_id, tax_rate_id, tax_name, tax_rate, taxable_amount, tax_amount)
    SELECT
        p_invoice_id,
        li.tax_rate_id,
        tr.name,
        tr.rate,
        SUM(li.amount),
        SUM(li.tax_amount)
    FROM public.invoice_line_items li
    JOIN public.tax_rates tr ON tr.id = li.tax_rate_id
    WHERE li.invoice_id = p_invoice_id
      AND li.tax_rate_id IS NOT NULL
      AND li.tax_amount > 0
    GROUP BY li.tax_rate_id, tr.name, tr.rate;

    IF EXISTS (
        SELECT 1
        FROM public.invoice_tax_summary
        WHERE invoice_id = p_invoice_id
          AND tax_amount > 0
    ) AND v_settings.default_tax_liability_account_id IS NULL THEN
        RAISE EXCEPTION 'Default tax liability account must be configured before sending a taxed invoice';
    END IF;

    -- Create auto-JE: Debit AR for total, Credit Revenue per line, Credit Tax Liability per tax rate
    v_je_number := public.allocate_je_number(v_invoice.company_id);

    INSERT INTO public.journal_entries (
        company_id, entry_number, entry_date, memo, reference,
        source_type, source_id, status, project_id, created_by
    )
    VALUES (
        v_invoice.company_id,
        v_je_number,
        v_invoice.invoice_date,
        'Invoice ' || v_invoice.invoice_number || ' — ' || v_invoice.customer_name,
        v_invoice.invoice_number,
        'invoice',
        v_invoice.id,
        'draft',
        v_invoice.project_id,
        auth.uid()
    )
    RETURNING id INTO v_je_id;

    -- Debit AR for full invoice total
    INSERT INTO public.journal_entry_lines (
        journal_entry_id, account_id, description,
        debit, credit, currency, exchange_rate, organization_id
    )
    VALUES (
        v_je_id,
        v_settings.default_ar_account_id,
        'AR — Invoice ' || v_invoice.invoice_number,
        v_invoice.total,
        0,
        v_invoice.currency,
        v_invoice.exchange_rate,
        v_invoice.organization_id
    );

    -- Credit Revenue per line item (grouped by account)
    INSERT INTO public.journal_entry_lines (
        journal_entry_id, account_id, description,
        debit, credit, currency, exchange_rate, organization_id
    )
    SELECT
        v_je_id,
        li.account_id,
        'Revenue — Invoice ' || v_invoice.invoice_number,
        0,
        SUM(li.amount),
        v_invoice.currency,
        v_invoice.exchange_rate,
        v_invoice.organization_id
    FROM public.invoice_line_items li
    WHERE li.invoice_id = p_invoice_id
    GROUP BY li.account_id;

    -- Credit Tax Liability per tax rate (from tax summary)
    IF v_settings.default_tax_liability_account_id IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines (
            journal_entry_id, account_id, description,
            debit, credit, currency, exchange_rate, organization_id
        )
        SELECT
            v_je_id,
            v_settings.default_tax_liability_account_id,
            'Tax — ' || ts.tax_name || ' — Invoice ' || v_invoice.invoice_number,
            0,
            ts.tax_amount,
            v_invoice.currency,
            v_invoice.exchange_rate,
            v_invoice.organization_id
        FROM public.invoice_tax_summary ts
        WHERE ts.invoice_id = p_invoice_id
          AND ts.tax_amount > 0;
    END IF;

    -- Post the JE (triggers validate balance)
    UPDATE public.journal_entries
    SET status = 'posted'
    WHERE id = v_je_id;

    -- Update invoice status
    UPDATE public.invoices
    SET status = 'sent',
        sent_at = NOW(),
        journal_entry_id = v_je_id
    WHERE id = p_invoice_id;

    RETURN v_je_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- RPC: Record payment against an invoice
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_invoice_payment(
    p_invoice_id UUID,
    p_payment_date DATE,
    p_amount DECIMAL(15,2),
    p_account_id UUID,
    p_payment_method TEXT DEFAULT NULL,
    p_reference TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_invoice RECORD;
    v_settings RECORD;
    v_payment_id UUID;
    v_je_id UUID;
    v_je_number INTEGER;
    v_new_amount_paid DECIMAL(15,2);
    v_new_balance DECIMAL(15,2);
    v_new_status TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Lock and fetch the invoice
    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF v_invoice IS NULL THEN
        RAISE EXCEPTION 'Invoice not found';
    END IF;

    IF v_invoice.status NOT IN ('sent', 'partially_paid', 'overdue') THEN
        RAISE EXCEPTION 'Cannot record payment for a % invoice', v_invoice.status;
    END IF;

    IF NOT public.has_accounting_role(v_invoice.company_id, 'member') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be positive';
    END IF;

    IF p_amount > v_invoice.balance_due THEN
        RAISE EXCEPTION 'Payment amount (%) exceeds balance due (%)', p_amount, v_invoice.balance_due;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.chart_of_accounts
        WHERE id = p_account_id
          AND company_id = v_invoice.company_id
          AND account_type = 'asset'
          AND deleted_at IS NULL
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Payment account must be an active asset account in this company';
    END IF;

    -- Fetch settings
    SELECT * INTO v_settings
    FROM public.accounting_settings
    WHERE company_id = v_invoice.company_id;

    IF v_settings IS NULL OR v_settings.default_ar_account_id IS NULL THEN
        RAISE EXCEPTION 'Default AR account must be configured';
    END IF;

    -- Create payment record
    INSERT INTO public.payments (
        company_id, payment_type, invoice_id, organization_id,
        payment_date, amount, currency, exchange_rate,
        payment_method, reference, account_id, notes,
        project_id, created_by
    )
    VALUES (
        v_invoice.company_id, 'received', p_invoice_id, v_invoice.organization_id,
        p_payment_date, p_amount, v_invoice.currency, v_invoice.exchange_rate,
        p_payment_method, p_reference, p_account_id, p_notes,
        v_invoice.project_id, auth.uid()
    )
    RETURNING id INTO v_payment_id;

    -- Create auto-JE: Debit Cash/Bank, Credit AR
    v_je_number := public.allocate_je_number(v_invoice.company_id);

    INSERT INTO public.journal_entries (
        company_id, entry_number, entry_date, memo, reference,
        source_type, source_id, status, project_id, created_by
    )
    VALUES (
        v_invoice.company_id,
        v_je_number,
        p_payment_date,
        'Payment for Invoice ' || v_invoice.invoice_number,
        p_reference,
        'payment',
        v_payment_id,
        'draft',
        v_invoice.project_id,
        auth.uid()
    )
    RETURNING id INTO v_je_id;

    -- Debit Cash/Bank
    INSERT INTO public.journal_entry_lines (
        journal_entry_id, account_id, description,
        debit, credit, currency, exchange_rate, organization_id
    )
    VALUES (
        v_je_id,
        p_account_id,
        'Payment received — Invoice ' || v_invoice.invoice_number,
        p_amount,
        0,
        v_invoice.currency,
        v_invoice.exchange_rate,
        v_invoice.organization_id
    );

    -- Credit AR
    INSERT INTO public.journal_entry_lines (
        journal_entry_id, account_id, description,
        debit, credit, currency, exchange_rate, organization_id
    )
    VALUES (
        v_je_id,
        v_settings.default_ar_account_id,
        'AR reduction — Invoice ' || v_invoice.invoice_number,
        0,
        p_amount,
        v_invoice.currency,
        v_invoice.exchange_rate,
        v_invoice.organization_id
    );

    -- Post the JE
    UPDATE public.journal_entries
    SET status = 'posted'
    WHERE id = v_je_id;

    -- Link JE to payment
    UPDATE public.payments
    SET journal_entry_id = v_je_id
    WHERE id = v_payment_id;

    -- Update invoice amounts
    v_new_amount_paid := v_invoice.amount_paid + p_amount;
    v_new_balance := v_invoice.total - v_new_amount_paid;

    IF v_new_balance <= 0 THEN
        v_new_status := 'paid';
    ELSE
        v_new_status := 'partially_paid';
    END IF;

    UPDATE public.invoices
    SET amount_paid = v_new_amount_paid,
        balance_due = v_new_balance,
        status = v_new_status,
        paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE NULL END
    WHERE id = p_invoice_id;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- RPC: Void invoice atomically
-- ============================================================

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

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE public.invoices IS 'Customer invoices with snapshot fields. Status transitions: draft -> sent -> partially_paid/paid. Voiding requires admin.';
COMMENT ON TABLE public.invoice_line_items IS 'Line items on an invoice with per-line tax and revenue account.';
COMMENT ON TABLE public.invoice_tax_summary IS 'Per-tax-rate totals snapshot, populated when invoice is sent.';
COMMENT ON TABLE public.payments IS 'Payment records for invoices (and later bills). Each payment auto-creates a journal entry.';
COMMENT ON FUNCTION public.create_invoice IS 'Atomically creates a draft invoice with line items.';
COMMENT ON FUNCTION public.update_draft_invoice IS 'Atomically updates a draft invoice header and replaces its line items.';
COMMENT ON FUNCTION public.send_invoice IS 'Finalizes a draft invoice: creates auto-JE (DR AR, CR Revenue/Tax), posts it, marks invoice as sent.';
COMMENT ON FUNCTION public.record_invoice_payment IS 'Records a payment against a sent/partially_paid invoice, creates auto-JE (DR Cash, CR AR), updates invoice balance.';
COMMENT ON FUNCTION public.void_invoice IS 'Voids a sent or overdue invoice with no payments and voids the associated journal entry in the same transaction.';
