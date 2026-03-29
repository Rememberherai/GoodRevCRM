-- Migration 0176: Accounting bug fixes (batch 3)
--
-- BUG-R: Invoice and bill line item validation triggers accept inactive
--   tax rates — add AND is_active = true to both.
--
-- v1-BUG-6: recompute_bill_totals (and recompute_invoice_totals) ignores
--   discount_amount column — both triggers calculate total as
--   subtotal + tax_total, silently producing wrong totals when a discount
--   is set. Fix both to subtract the header-level discount.

-- ============================================================
-- BUG-R: Reject inactive tax rates on invoice line items
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
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Invoice tax rate must be an active tax rate in this company';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- BUG-R: Reject inactive tax rates on bill line items
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
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Bill tax rate must be an active tax rate in this company';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- v1-BUG-6: recompute_invoice_totals — apply discount_amount
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id UUID;
    v_subtotal DECIMAL(15,2);
    v_tax_total DECIMAL(15,2);
    v_discount_amount DECIMAL(15,2);
    v_total DECIMAL(15,2);
    v_amount_paid DECIMAL(15,2);
BEGIN
    v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

    SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(tax_amount), 0)
    INTO v_subtotal, v_tax_total
    FROM public.invoice_line_items
    WHERE invoice_id = v_invoice_id;

    SELECT amount_paid, COALESCE(discount_amount, 0)
    INTO v_amount_paid, v_discount_amount
    FROM public.invoices
    WHERE id = v_invoice_id;

    v_total := v_subtotal + v_tax_total - v_discount_amount;

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

-- ============================================================
-- v1-BUG-6: recompute_bill_totals — apply discount_amount
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_bill_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_bill_id UUID;
    v_subtotal DECIMAL(15,2);
    v_tax_total DECIMAL(15,2);
    v_discount_amount DECIMAL(15,2);
    v_total DECIMAL(15,2);
    v_amount_paid DECIMAL(15,2);
BEGIN
    v_bill_id := COALESCE(NEW.bill_id, OLD.bill_id);

    SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(tax_amount), 0)
    INTO v_subtotal, v_tax_total
    FROM public.bill_line_items
    WHERE bill_id = v_bill_id;

    SELECT amount_paid, COALESCE(discount_amount, 0)
    INTO v_amount_paid, v_discount_amount
    FROM public.bills
    WHERE id = v_bill_id;

    v_total := v_subtotal + v_tax_total - v_discount_amount;

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
