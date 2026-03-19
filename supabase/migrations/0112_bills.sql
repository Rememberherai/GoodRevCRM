-- Migration 0112: Bills, Bill Line Items, Bill Tax Summary
-- Phase 4: Accounts Payable — bill management and vendor payments.
-- Mirrors the invoice structure (0104_invoices.sql) with reversed JE direction.

-- ============================================================
-- Bills
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.accounting_companies(id) ON DELETE CASCADE,
    bill_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'received', 'partially_paid', 'paid', 'overdue', 'voided')),

    -- Immutable vendor snapshot (survives CRM changes)
    vendor_name TEXT NOT NULL,
    vendor_email TEXT,
    vendor_address TEXT,
    vendor_phone TEXT,

    -- Optional CRM navigation references (no strict FK enforcement for cross-scope)
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

    bill_date DATE NOT NULL,
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

    -- Auto-JE reference (created on receive)
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,

    received_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,

    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT unique_bill_number_per_company UNIQUE (company_id, bill_number)
);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_bills_updated_at
    BEFORE UPDATE ON public.bills
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bills_company_id ON public.bills(company_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(company_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_bill_date ON public.bills(company_id, bill_date);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON public.bills(company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_bills_organization_id ON public.bills(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bills_project_id ON public.bills(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bills_journal_entry_id ON public.bills(journal_entry_id) WHERE journal_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bills_deleted_at ON public.bills(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- Bill Line Items
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bill_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
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

ALTER TABLE public.bill_line_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_bill_line_items_bill_id ON public.bill_line_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_line_items_account_id ON public.bill_line_items(account_id);

-- ============================================================
-- Bill Tax Summary (populated at receive time)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bill_tax_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    tax_rate_id UUID NOT NULL REFERENCES public.tax_rates(id) ON DELETE RESTRICT,
    tax_name TEXT NOT NULL,
    tax_rate DECIMAL(5,4) NOT NULL,
    taxable_amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bill_tax_summary ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_bill_tax_summary_bill_id ON public.bill_tax_summary(bill_id);

-- ============================================================
-- Add bill_id FK to payments table
-- ============================================================

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON public.payments(bill_id) WHERE bill_id IS NOT NULL;

-- ============================================================
-- RLS Policies — Bills
-- ============================================================

CREATE POLICY "Members can view bills"
    ON public.bills FOR SELECT
    USING (deleted_at IS NULL AND public.is_accounting_member(company_id));

CREATE POLICY "Admins can delete draft bills"
    ON public.bills FOR DELETE
    USING (
        public.has_accounting_role(company_id, 'admin')
        AND status = 'draft'
    );

-- ============================================================
-- RLS Policies — Bill Line Items (via parent bill)
-- ============================================================

CREATE POLICY "Members can view bill line items"
    ON public.bill_line_items FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.bills b
        WHERE b.id = bill_id AND b.deleted_at IS NULL
        AND public.is_accounting_member(b.company_id)
    ));

-- ============================================================
-- RLS Policies — Bill Tax Summary (via parent bill)
-- ============================================================

CREATE POLICY "Members can view bill tax summary"
    ON public.bill_tax_summary FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.bills b
        WHERE b.id = bill_id AND b.deleted_at IS NULL
        AND public.is_accounting_member(b.company_id)
    ));

-- ============================================================
-- Trigger: Compute bill line item amount and tax
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_bill_line_amounts()
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

CREATE TRIGGER compute_bill_line_amounts_trigger
    BEFORE INSERT OR UPDATE ON public.bill_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.compute_bill_line_amounts();

-- ============================================================
-- Trigger: Validate bill line item references
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_bill_line_item_references()
RETURNS TRIGGER AS $$
DECLARE
    v_company_id UUID;
BEGIN
    SELECT company_id
    INTO v_company_id
    FROM public.bills
    WHERE id = NEW.bill_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Bill not found';
    END IF;

    -- Bill line items use expense accounts (not revenue)
    IF NOT EXISTS (
        SELECT 1
        FROM public.chart_of_accounts
        WHERE id = NEW.account_id
          AND company_id = v_company_id
          AND account_type = 'expense'
          AND deleted_at IS NULL
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Bill line account must be an active expense account in this company';
    END IF;

    IF NEW.tax_rate_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.tax_rates
        WHERE id = NEW.tax_rate_id
          AND company_id = v_company_id
    ) THEN
        RAISE EXCEPTION 'Bill tax rate must belong to this company';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_bill_line_item_references_trigger
    BEFORE INSERT OR UPDATE ON public.bill_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_bill_line_item_references();

-- ============================================================
-- Trigger: Recompute bill totals on line item changes
-- ============================================================

CREATE OR REPLACE FUNCTION public.recompute_bill_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_bill_id UUID;
    v_subtotal DECIMAL(15,2);
    v_tax_total DECIMAL(15,2);
    v_total DECIMAL(15,2);
    v_amount_paid DECIMAL(15,2);
BEGIN
    v_bill_id := COALESCE(NEW.bill_id, OLD.bill_id);

    SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(tax_amount), 0)
    INTO v_subtotal, v_tax_total
    FROM public.bill_line_items
    WHERE bill_id = v_bill_id;

    v_total := v_subtotal + v_tax_total;

    SELECT amount_paid INTO v_amount_paid
    FROM public.bills
    WHERE id = v_bill_id;

    UPDATE public.bills
    SET subtotal = v_subtotal,
        tax_total = v_tax_total,
        total = v_total,
        balance_due = v_total - COALESCE(v_amount_paid, 0)
    WHERE id = v_bill_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recompute_bill_totals_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.bill_line_items
    FOR EACH ROW
    EXECUTE FUNCTION public.recompute_bill_totals();

-- ============================================================
-- RPC: Create bill atomically (header + lines)
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_bill(
    p_company_id UUID,
    p_vendor_name TEXT,
    p_bill_date DATE,
    p_due_date DATE,
    p_lines JSONB,
    p_vendor_email TEXT DEFAULT NULL,
    p_vendor_address TEXT DEFAULT NULL,
    p_vendor_phone TEXT DEFAULT NULL,
    p_organization_id UUID DEFAULT NULL,
    p_contact_id UUID DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_currency TEXT DEFAULT 'USD',
    p_exchange_rate DECIMAL DEFAULT 1.0,
    p_notes TEXT DEFAULT NULL,
    p_payment_terms INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_bill_id UUID;
    v_bill_number TEXT;
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

    IF p_due_date < p_bill_date THEN
        RAISE EXCEPTION 'Due date cannot be before bill date';
    END IF;

    v_bill_number := public.allocate_bill_number(p_company_id);

    INSERT INTO public.bills (
        company_id, bill_number, vendor_name, vendor_email,
        vendor_address, vendor_phone, organization_id, contact_id,
        project_id, bill_date, due_date, payment_terms,
        currency, exchange_rate, notes, created_by
    )
    VALUES (
        p_company_id, v_bill_number, p_vendor_name, p_vendor_email,
        p_vendor_address, p_vendor_phone, p_organization_id, p_contact_id,
        p_project_id, p_bill_date, p_due_date, p_payment_terms,
        p_currency, p_exchange_rate, p_notes, auth.uid()
    )
    RETURNING id INTO v_bill_id;

    INSERT INTO public.bill_line_items (
        bill_id, description, quantity, unit_price,
        account_id, tax_rate_id, sort_order
    )
    SELECT
        v_bill_id,
        line->>'description',
        COALESCE((line->>'quantity')::DECIMAL(15,4), 1),
        (line->>'unit_price')::DECIMAL(15,4),
        (line->>'account_id')::UUID,
        CASE WHEN NULLIF(line->>'tax_rate_id', '') IS NULL THEN NULL
             ELSE (line->>'tax_rate_id')::UUID END,
        COALESCE((line->>'sort_order')::INTEGER, idx - 1)
    FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS t(line, idx);

    RETURN v_bill_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- RPC: Update draft bill atomically (header + lines)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_draft_bill(
    p_bill_id UUID,
    p_patch JSONB DEFAULT '{}'::JSONB,
    p_lines JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_bill public.bills%ROWTYPE;
    v_bill_date DATE;
    v_due_date DATE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT *
    INTO v_bill
    FROM public.bills
    WHERE id = p_bill_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bill not found';
    END IF;

    IF v_bill.status != 'draft' THEN
        RAISE EXCEPTION 'Can only edit draft bills';
    END IF;

    IF NOT public.has_accounting_role(v_bill.company_id, 'member') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    v_bill_date := COALESCE(
        CASE WHEN p_patch ? 'bill_date' THEN (p_patch->>'bill_date')::DATE END,
        v_bill.bill_date
    );
    v_due_date := COALESCE(
        CASE WHEN p_patch ? 'due_date' THEN (p_patch->>'due_date')::DATE END,
        v_bill.due_date
    );

    IF v_due_date < v_bill_date THEN
        RAISE EXCEPTION 'Due date cannot be before bill date';
    END IF;

    UPDATE public.bills
    SET vendor_name = CASE WHEN p_patch ? 'vendor_name' THEN p_patch->>'vendor_name' ELSE vendor_name END,
        vendor_email = CASE WHEN p_patch ? 'vendor_email' THEN NULLIF(p_patch->>'vendor_email', '') ELSE vendor_email END,
        vendor_address = CASE WHEN p_patch ? 'vendor_address' THEN NULLIF(p_patch->>'vendor_address', '') ELSE vendor_address END,
        vendor_phone = CASE WHEN p_patch ? 'vendor_phone' THEN NULLIF(p_patch->>'vendor_phone', '') ELSE vendor_phone END,
        organization_id = CASE WHEN p_patch ? 'organization_id' THEN NULLIF(p_patch->>'organization_id', '')::UUID ELSE organization_id END,
        contact_id = CASE WHEN p_patch ? 'contact_id' THEN NULLIF(p_patch->>'contact_id', '')::UUID ELSE contact_id END,
        project_id = CASE WHEN p_patch ? 'project_id' THEN NULLIF(p_patch->>'project_id', '')::UUID ELSE project_id END,
        bill_date = v_bill_date,
        due_date = v_due_date,
        payment_terms = CASE WHEN p_patch ? 'payment_terms' THEN (p_patch->>'payment_terms')::INTEGER ELSE payment_terms END,
        currency = CASE WHEN p_patch ? 'currency' THEN p_patch->>'currency' ELSE currency END,
        exchange_rate = CASE WHEN p_patch ? 'exchange_rate' THEN (p_patch->>'exchange_rate')::DECIMAL ELSE exchange_rate END,
        notes = CASE WHEN p_patch ? 'notes' THEN NULLIF(p_patch->>'notes', '') ELSE notes END
    WHERE id = p_bill_id;

    IF p_lines IS NOT NULL THEN
        IF jsonb_typeof(p_lines) != 'array' OR jsonb_array_length(p_lines) < 1 THEN
            RAISE EXCEPTION 'At least 1 line item is required';
        END IF;

        DELETE FROM public.bill_line_items
        WHERE bill_id = p_bill_id;

        INSERT INTO public.bill_line_items (
            bill_id, description, quantity, unit_price,
            account_id, tax_rate_id, sort_order
        )
        SELECT
            p_bill_id,
            line->>'description',
            COALESCE((line->>'quantity')::DECIMAL(15,4), 1),
            (line->>'unit_price')::DECIMAL(15,4),
            (line->>'account_id')::UUID,
            CASE WHEN NULLIF(line->>'tax_rate_id', '') IS NULL THEN NULL
                 ELSE (line->>'tax_rate_id')::UUID END,
            COALESCE((line->>'sort_order')::INTEGER, idx - 1)
        FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS t(line, idx);
    END IF;

    RETURN p_bill_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- RPC: Receive bill (finalize, create auto-JE, post it)
-- Reversed JE direction vs send_invoice:
--   DR Expense (per line account), DR Tax (if applicable)
--   CR AP
-- ============================================================

CREATE OR REPLACE FUNCTION public.receive_bill(p_bill_id UUID)
RETURNS UUID AS $$
DECLARE
    v_bill RECORD;
    v_settings RECORD;
    v_je_id UUID;
    v_je_number INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Lock and fetch the bill
    SELECT * INTO v_bill
    FROM public.bills
    WHERE id = p_bill_id
    FOR UPDATE;

    IF v_bill IS NULL THEN
        RAISE EXCEPTION 'Bill not found';
    END IF;

    IF v_bill.status != 'draft' THEN
        RAISE EXCEPTION 'Can only receive draft bills (current status: %)', v_bill.status;
    END IF;

    IF NOT public.has_accounting_role(v_bill.company_id, 'member') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    -- Fetch settings for default accounts
    SELECT * INTO v_settings
    FROM public.accounting_settings
    WHERE company_id = v_bill.company_id;

    IF v_settings IS NULL OR v_settings.default_ap_account_id IS NULL THEN
        RAISE EXCEPTION 'Default AP account must be configured in accounting settings';
    END IF;

    -- Verify bill has line items and a positive total
    IF v_bill.total <= 0 THEN
        RAISE EXCEPTION 'Bill total must be positive';
    END IF;

    -- Populate bill_tax_summary from line items
    DELETE FROM public.bill_tax_summary WHERE bill_id = p_bill_id;

    INSERT INTO public.bill_tax_summary (bill_id, tax_rate_id, tax_name, tax_rate, taxable_amount, tax_amount)
    SELECT
        p_bill_id,
        li.tax_rate_id,
        tr.name,
        tr.rate,
        SUM(li.amount),
        SUM(li.tax_amount)
    FROM public.bill_line_items li
    JOIN public.tax_rates tr ON tr.id = li.tax_rate_id
    WHERE li.bill_id = p_bill_id
      AND li.tax_rate_id IS NOT NULL
      AND li.tax_amount > 0
    GROUP BY li.tax_rate_id, tr.name, tr.rate;

    IF EXISTS (
        SELECT 1
        FROM public.bill_tax_summary
        WHERE bill_id = p_bill_id
          AND tax_amount > 0
    ) AND v_settings.default_tax_liability_account_id IS NULL THEN
        RAISE EXCEPTION 'Default tax liability account must be configured before receiving a taxed bill';
    END IF;

    -- Create auto-JE: Debit Expense per line + Debit Tax, Credit AP for total
    v_je_number := public.allocate_je_number(v_bill.company_id);

    INSERT INTO public.journal_entries (
        company_id, entry_number, entry_date, memo, reference,
        source_type, source_id, status, project_id, created_by
    )
    VALUES (
        v_bill.company_id,
        v_je_number,
        v_bill.bill_date,
        'Bill ' || v_bill.bill_number || ' — ' || v_bill.vendor_name,
        v_bill.bill_number,
        'bill',
        v_bill.id,
        'draft',
        v_bill.project_id,
        auth.uid()
    )
    RETURNING id INTO v_je_id;

    -- Debit Expense per line item (grouped by account)
    INSERT INTO public.journal_entry_lines (
        journal_entry_id, account_id, description,
        debit, credit, currency, exchange_rate, organization_id
    )
    SELECT
        v_je_id,
        li.account_id,
        'Expense — Bill ' || v_bill.bill_number,
        SUM(li.amount),
        0,
        v_bill.currency,
        v_bill.exchange_rate,
        v_bill.organization_id
    FROM public.bill_line_items li
    WHERE li.bill_id = p_bill_id
    GROUP BY li.account_id;

    -- Debit Tax per tax rate (from tax summary)
    IF v_settings.default_tax_liability_account_id IS NOT NULL THEN
        INSERT INTO public.journal_entry_lines (
            journal_entry_id, account_id, description,
            debit, credit, currency, exchange_rate, organization_id
        )
        SELECT
            v_je_id,
            v_settings.default_tax_liability_account_id,
            'Tax — ' || ts.tax_name || ' — Bill ' || v_bill.bill_number,
            ts.tax_amount,
            0,
            v_bill.currency,
            v_bill.exchange_rate,
            v_bill.organization_id
        FROM public.bill_tax_summary ts
        WHERE ts.bill_id = p_bill_id
          AND ts.tax_amount > 0;
    END IF;

    -- Credit AP for full bill total
    INSERT INTO public.journal_entry_lines (
        journal_entry_id, account_id, description,
        debit, credit, currency, exchange_rate, organization_id
    )
    VALUES (
        v_je_id,
        v_settings.default_ap_account_id,
        'AP — Bill ' || v_bill.bill_number,
        0,
        v_bill.total,
        v_bill.currency,
        v_bill.exchange_rate,
        v_bill.organization_id
    );

    -- Post the JE (triggers validate balance)
    UPDATE public.journal_entries
    SET status = 'posted'
    WHERE id = v_je_id;

    -- Update bill status
    UPDATE public.bills
    SET status = 'received',
        received_at = NOW(),
        journal_entry_id = v_je_id
    WHERE id = p_bill_id;

    RETURN v_je_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- RPC: Record payment against a bill
-- Reversed JE direction vs record_invoice_payment:
--   DR AP
--   CR Cash/Bank
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_bill_payment(
    p_bill_id UUID,
    p_payment_date DATE,
    p_amount DECIMAL(15,2),
    p_account_id UUID,
    p_payment_method TEXT DEFAULT NULL,
    p_reference TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_bill RECORD;
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

    -- Lock and fetch the bill
    SELECT * INTO v_bill
    FROM public.bills
    WHERE id = p_bill_id
    FOR UPDATE;

    IF v_bill IS NULL THEN
        RAISE EXCEPTION 'Bill not found';
    END IF;

    IF v_bill.status NOT IN ('received', 'partially_paid', 'overdue') THEN
        RAISE EXCEPTION 'Cannot record payment for a % bill', v_bill.status;
    END IF;

    IF NOT public.has_accounting_role(v_bill.company_id, 'member') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be positive';
    END IF;

    IF p_amount > v_bill.balance_due THEN
        RAISE EXCEPTION 'Payment amount (%) exceeds balance due (%)', p_amount, v_bill.balance_due;
    END IF;

    IF p_payment_date < v_bill.bill_date THEN
        RAISE EXCEPTION 'Payment date cannot be before bill date';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.chart_of_accounts
        WHERE id = p_account_id
          AND company_id = v_bill.company_id
          AND account_type = 'asset'
          AND deleted_at IS NULL
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Payment account must be an active asset account in this company';
    END IF;

    -- Fetch settings
    SELECT * INTO v_settings
    FROM public.accounting_settings
    WHERE company_id = v_bill.company_id;

    IF v_settings IS NULL OR v_settings.default_ap_account_id IS NULL THEN
        RAISE EXCEPTION 'Default AP account must be configured';
    END IF;

    -- Create payment record
    INSERT INTO public.payments (
        company_id, payment_type, bill_id, organization_id,
        payment_date, amount, currency, exchange_rate,
        payment_method, reference, account_id, notes,
        project_id, created_by
    )
    VALUES (
        v_bill.company_id, 'sent', p_bill_id, v_bill.organization_id,
        p_payment_date, p_amount, v_bill.currency, v_bill.exchange_rate,
        p_payment_method, p_reference, p_account_id, p_notes,
        v_bill.project_id, auth.uid()
    )
    RETURNING id INTO v_payment_id;

    -- Create auto-JE: Debit AP, Credit Cash/Bank
    v_je_number := public.allocate_je_number(v_bill.company_id);

    INSERT INTO public.journal_entries (
        company_id, entry_number, entry_date, memo, reference,
        source_type, source_id, status, project_id, created_by
    )
    VALUES (
        v_bill.company_id,
        v_je_number,
        p_payment_date,
        'Payment for Bill ' || v_bill.bill_number,
        p_reference,
        'payment',
        v_payment_id,
        'draft',
        v_bill.project_id,
        auth.uid()
    )
    RETURNING id INTO v_je_id;

    -- Debit AP
    INSERT INTO public.journal_entry_lines (
        journal_entry_id, account_id, description,
        debit, credit, currency, exchange_rate, organization_id
    )
    VALUES (
        v_je_id,
        v_settings.default_ap_account_id,
        'AP reduction — Bill ' || v_bill.bill_number,
        p_amount,
        0,
        v_bill.currency,
        v_bill.exchange_rate,
        v_bill.organization_id
    );

    -- Credit Cash/Bank
    INSERT INTO public.journal_entry_lines (
        journal_entry_id, account_id, description,
        debit, credit, currency, exchange_rate, organization_id
    )
    VALUES (
        v_je_id,
        p_account_id,
        'Payment sent — Bill ' || v_bill.bill_number,
        0,
        p_amount,
        v_bill.currency,
        v_bill.exchange_rate,
        v_bill.organization_id
    );

    -- Post the JE
    UPDATE public.journal_entries
    SET status = 'posted'
    WHERE id = v_je_id;

    -- Link JE to payment
    UPDATE public.payments
    SET journal_entry_id = v_je_id
    WHERE id = v_payment_id;

    -- Update bill amounts
    v_new_amount_paid := v_bill.amount_paid + p_amount;
    v_new_balance := v_bill.total - v_new_amount_paid;

    IF v_new_balance <= 0 THEN
        v_new_status := 'paid';
    ELSE
        v_new_status := 'partially_paid';
    END IF;

    UPDATE public.bills
    SET amount_paid = v_new_amount_paid,
        balance_due = v_new_balance,
        status = v_new_status,
        paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE NULL END
    WHERE id = p_bill_id;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- RPC: Void bill atomically
-- ============================================================

CREATE OR REPLACE FUNCTION public.void_bill(p_bill_id UUID)
RETURNS UUID AS $$
DECLARE
    v_bill RECORD;
    v_payment_count BIGINT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_bill
    FROM public.bills
    WHERE id = p_bill_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF v_bill IS NULL THEN
        RAISE EXCEPTION 'Bill not found';
    END IF;

    IF NOT public.has_accounting_role(v_bill.company_id, 'admin') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    IF v_bill.status NOT IN ('received', 'overdue') THEN
        RAISE EXCEPTION 'Cannot void a % bill', v_bill.status;
    END IF;

    SELECT COUNT(*)
    INTO v_payment_count
    FROM public.payments
    WHERE bill_id = p_bill_id
      AND deleted_at IS NULL;

    IF v_payment_count > 0 THEN
        RAISE EXCEPTION 'Cannot void a bill with payments';
    END IF;

    IF v_bill.journal_entry_id IS NOT NULL THEN
        PERFORM public.void_journal_entry(v_bill.journal_entry_id);
    END IF;

    UPDATE public.bills
    SET status = 'voided',
        voided_at = NOW(),
        amount_paid = 0,
        balance_due = 0,
        paid_at = NULL
    WHERE id = p_bill_id;

    RETURN p_bill_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE public.bills IS 'Vendor bills with snapshot fields. Status transitions: draft -> received -> partially_paid/paid. Voiding requires admin.';
COMMENT ON TABLE public.bill_line_items IS 'Line items on a bill with per-line tax and expense account.';
COMMENT ON TABLE public.bill_tax_summary IS 'Per-tax-rate totals snapshot, populated when bill is received.';
COMMENT ON FUNCTION public.create_bill IS 'Atomically creates a draft bill with line items.';
COMMENT ON FUNCTION public.update_draft_bill IS 'Atomically updates a draft bill header and replaces its line items.';
COMMENT ON FUNCTION public.receive_bill IS 'Finalizes a draft bill: creates auto-JE (DR Expense/Tax, CR AP), posts it, marks bill as received.';
COMMENT ON FUNCTION public.record_bill_payment IS 'Records a payment against a received/partially_paid bill, creates auto-JE (DR AP, CR Cash), updates bill balance.';
COMMENT ON FUNCTION public.void_bill IS 'Voids a received or overdue bill with no payments and voids the associated journal entry.';
