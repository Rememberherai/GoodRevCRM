-- Migration 0173: Accounting & contracts bug fixes
-- Covers: BUG-BP, BUG-BF, BUG-J, BUG-AS, BUG-U, BUG-H, BUG-V, BUG-AI,
--         BUG-G, BUG-AX, BUG-AJ, BUG-BK

-- ============================================================
-- BUG-BP: Contract tables — restrict write policies to member+
-- ============================================================

-- contract_documents

DROP POLICY IF EXISTS "contract_documents_insert" ON public.contract_documents;
DROP POLICY IF EXISTS "contract_documents_update" ON public.contract_documents;
DROP POLICY IF EXISTS "contract_documents_delete" ON public.contract_documents;

CREATE POLICY "contract_documents_insert" ON public.contract_documents
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_documents.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "contract_documents_update" ON public.contract_documents
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_documents.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "contract_documents_delete" ON public.contract_documents
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_documents.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('owner', 'admin', 'member')
        )
    );

-- contract_recipients

DROP POLICY IF EXISTS "contract_recipients_insert" ON public.contract_recipients;
DROP POLICY IF EXISTS "contract_recipients_update" ON public.contract_recipients;
DROP POLICY IF EXISTS "contract_recipients_delete" ON public.contract_recipients;

CREATE POLICY "contract_recipients_insert" ON public.contract_recipients
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_recipients.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "contract_recipients_update" ON public.contract_recipients
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_recipients.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "contract_recipients_delete" ON public.contract_recipients
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_recipients.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('owner', 'admin', 'member')
        )
    );

-- contract_fields

DROP POLICY IF EXISTS "contract_fields_insert" ON public.contract_fields;
DROP POLICY IF EXISTS "contract_fields_update" ON public.contract_fields;
DROP POLICY IF EXISTS "contract_fields_delete" ON public.contract_fields;

CREATE POLICY "contract_fields_insert" ON public.contract_fields
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_fields.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "contract_fields_update" ON public.contract_fields
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_fields.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "contract_fields_delete" ON public.contract_fields
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_fields.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('owner', 'admin', 'member')
        )
    );

-- ============================================================
-- BUG-BF: check_je_balance_on_post — reject all-zero JEs
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_je_balance_on_post()
RETURNS TRIGGER AS $$
DECLARE
    total_debit DECIMAL(15,2);
    total_credit DECIMAL(15,2);
    line_count INTEGER;
BEGIN
    -- Only check when status is changing to 'posted'
    IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
        SELECT COALESCE(SUM(base_debit), 0), COALESCE(SUM(base_credit), 0), COUNT(*)
        INTO total_debit, total_credit, line_count
        FROM public.journal_entry_lines
        WHERE journal_entry_id = NEW.id;

        -- Minimum 2 lines
        IF line_count < 2 THEN
            RAISE EXCEPTION 'Journal entry must have at least 2 lines to be posted (has %)', line_count;
        END IF;

        -- Debits must equal credits
        IF total_debit != total_credit THEN
            RAISE EXCEPTION 'Journal entry is unbalanced: debits (%) != credits (%)', total_debit, total_credit;
        END IF;

        -- BUG-BF: Reject phantom zero-amount entries
        IF total_debit = 0 THEN
            RAISE EXCEPTION 'Journal entry must have at least one non-zero amount line';
        END IF;

        -- Set posted_at timestamp
        NEW.posted_at := NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- BUG-J: protect_posted_je_header — include deleted_at in immutability check
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_posted_je_header()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('posted', 'voided') THEN
        -- Allow status transition: posted -> voided
        IF OLD.status = 'posted' AND NEW.status = 'voided' THEN
            -- Only allow changing status, voided_at, voided_by_entry_id, updated_at
            IF NEW.entry_date != OLD.entry_date
                OR NEW.memo IS DISTINCT FROM OLD.memo
                OR NEW.reference IS DISTINCT FROM OLD.reference
                OR NEW.source_type IS DISTINCT FROM OLD.source_type
                OR NEW.source_id IS DISTINCT FROM OLD.source_id
                OR NEW.project_id IS DISTINCT FROM OLD.project_id
                OR NEW.entry_number != OLD.entry_number
                OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
            THEN
                RAISE EXCEPTION 'Cannot modify fields of a posted journal entry (only status, voided_at, voided_by_entry_id may change)';
            END IF;
            RETURN NEW;
        END IF;

        -- Allow updated_at changes (from trigger)
        IF NEW.status = OLD.status
            AND NEW.entry_date = OLD.entry_date
            AND NEW.memo IS NOT DISTINCT FROM OLD.memo
            AND NEW.reference IS NOT DISTINCT FROM OLD.reference
            AND NEW.source_type IS NOT DISTINCT FROM OLD.source_type
            AND NEW.source_id IS NOT DISTINCT FROM OLD.source_id
            AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id
            AND NEW.entry_number = OLD.entry_number
            AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
        THEN
            RETURN NEW;
        END IF;

        RAISE EXCEPTION 'Cannot modify a % journal entry', OLD.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- BUG-AS: journal_entry_lines.exchange_rate — require > 0
-- ============================================================

ALTER TABLE public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_exchange_rate_positive
    CHECK (exchange_rate > 0);

-- ============================================================
-- BUG-U: record_invoice_payment — add deleted_at IS NULL
-- BUG-H: send_invoice — add deleted_at IS NULL
-- BUG-G: record_invoice_payment — payment_date >= invoice_date
-- ============================================================

CREATE OR REPLACE FUNCTION public.send_invoice(p_invoice_id UUID)
RETURNS UUID AS $$
DECLARE
    v_invoice RECORD;
    v_settings RECORD;
    v_je_id UUID;
    v_je_number INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- BUG-H fix: include deleted_at IS NULL
    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id
      AND deleted_at IS NULL
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

    -- BUG-U fix: include deleted_at IS NULL
    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id
      AND deleted_at IS NULL
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

    -- BUG-G fix: payment date must not precede invoice date
    IF p_payment_date < v_invoice.invoice_date THEN
        RAISE EXCEPTION 'Payment date (%) cannot be before invoice date (%)', p_payment_date, v_invoice.invoice_date;
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

    -- Update invoice amounts and status
    v_new_amount_paid := v_invoice.amount_paid + p_amount;
    v_new_balance     := v_invoice.total - v_new_amount_paid;
    v_new_status := CASE
        WHEN v_new_balance <= 0 THEN 'paid'
        ELSE 'partially_paid'
    END;

    UPDATE public.invoices
    SET amount_paid  = v_new_amount_paid,
        balance_due  = v_new_balance,
        status       = v_new_status,
        paid_at      = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE paid_at END
    WHERE id = p_invoice_id;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- BUG-AX: void_invoice — add 'partially_paid' to voidable statuses
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

    -- BUG-AX fix: include 'partially_paid' — guard below still blocks if there are real payments
    IF v_invoice.status NOT IN ('sent', 'overdue', 'partially_paid') THEN
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
-- BUG-V: record_bill_payment — add deleted_at IS NULL
-- BUG-AI: receive_bill — add deleted_at IS NULL
-- BUG-AX: void_bill — add 'partially_paid' to voidable statuses
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

    -- BUG-AI fix: include deleted_at IS NULL
    SELECT * INTO v_bill
    FROM public.bills
    WHERE id = p_bill_id
      AND deleted_at IS NULL
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

    -- BUG-V fix: include deleted_at IS NULL
    SELECT * INTO v_bill
    FROM public.bills
    WHERE id = p_bill_id
      AND deleted_at IS NULL
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
        v_bill.company_id, 'made', p_bill_id, v_bill.organization_id,
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
        'Payment made — Bill ' || v_bill.bill_number,
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

    -- Update bill amounts and status
    v_new_amount_paid := v_bill.amount_paid + p_amount;
    v_new_balance     := v_bill.total - v_new_amount_paid;
    v_new_status := CASE
        WHEN v_new_balance <= 0 THEN 'paid'
        ELSE 'partially_paid'
    END;

    UPDATE public.bills
    SET amount_paid = v_new_amount_paid,
        balance_due = v_new_balance,
        status      = v_new_status,
        paid_at     = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE paid_at END
    WHERE id = p_bill_id;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

    -- BUG-AX fix: include 'partially_paid' — guard below still blocks if there are real payments
    IF v_bill.status NOT IN ('received', 'overdue', 'partially_paid') THEN
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
-- BUG-AJ: create_bill service-role path — verify company exists
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
    p_payment_terms INTEGER DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_bill_id UUID;
    v_bill_number TEXT;
    v_actor_id UUID;
BEGIN
    v_actor_id := COALESCE(auth.uid(), p_created_by);

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- BUG-AJ fix: when called from service role, verify the company exists
    IF auth.uid() IS NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.accounting_companies WHERE id = p_company_id
        ) THEN
            RAISE EXCEPTION 'Accounting company not found: %', p_company_id;
        END IF;
    ELSE
        IF NOT public.has_accounting_role(p_company_id, 'member') THEN
            RAISE EXCEPTION 'Insufficient permissions';
        END IF;
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
        p_currency, p_exchange_rate, p_notes, v_actor_id
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
-- BUG-BK: bank_transactions — unique index for duplicate detection
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transactions_dedup
    ON public.bank_transactions (bank_account_id, transaction_date, amount, description)
    WHERE import_source = 'csv';
