-- Migration 097: Accounting settings and tax rates
-- Per-company configuration for accounting defaults, and relational tax rates table.

-- ============================================================
-- Accounting Settings (one row per company)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.accounting_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE REFERENCES public.accounting_companies(id) ON DELETE CASCADE,

    default_payment_terms INTEGER NOT NULL DEFAULT 30,
    invoice_notes TEXT,
    invoice_footer TEXT,

    -- Default GL account references (populated after chart of accounts is seeded)
    default_revenue_account_id UUID,
    default_expense_account_id UUID,
    default_ar_account_id UUID,
    default_ap_account_id UUID,
    default_cash_account_id UUID,
    default_tax_liability_account_id UUID,
    default_fx_gain_loss_account_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.accounting_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_accounting_settings_updated_at
    BEFORE UPDATE ON public.accounting_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS: members can view, admins can update
CREATE POLICY "Members can view accounting settings"
    ON public.accounting_settings
    FOR SELECT
    USING (public.is_accounting_member(company_id));

CREATE POLICY "Admins can insert accounting settings"
    ON public.accounting_settings
    FOR INSERT
    WITH CHECK (public.has_accounting_role(company_id, 'admin'));

CREATE POLICY "Admins can update accounting settings"
    ON public.accounting_settings
    FOR UPDATE
    USING (public.has_accounting_role(company_id, 'admin'))
    WITH CHECK (public.has_accounting_role(company_id, 'admin'));

-- ============================================================
-- Tax Rates (relational table, not JSONB)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tax_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.accounting_companies(id) ON DELETE CASCADE,

    name TEXT NOT NULL,                          -- e.g. "Standard", "Reduced", "Exempt"
    rate DECIMAL(5,4) NOT NULL DEFAULT 0,        -- e.g. 0.0825 for 8.25%
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,   -- At most one default per company
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_tax_rates_updated_at
    BEFORE UPDATE ON public.tax_rates
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tax_rates_company_id
    ON public.tax_rates(company_id);
CREATE INDEX IF NOT EXISTS idx_tax_rates_company_default
    ON public.tax_rates(company_id) WHERE is_default = true;

-- Enforce at most one default tax rate per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_rates_unique_default
    ON public.tax_rates(company_id) WHERE is_default = true AND is_active = true;

-- RLS
CREATE POLICY "Members can view tax rates"
    ON public.tax_rates
    FOR SELECT
    USING (public.is_accounting_member(company_id));

CREATE POLICY "Admins can create tax rates"
    ON public.tax_rates
    FOR INSERT
    WITH CHECK (public.has_accounting_role(company_id, 'admin'));

CREATE POLICY "Admins can update tax rates"
    ON public.tax_rates
    FOR UPDATE
    USING (public.has_accounting_role(company_id, 'admin'))
    WITH CHECK (public.has_accounting_role(company_id, 'admin'));

-- Tax rates should not be deleted (deactivate instead for historical integrity)
-- But allow delete for rates that have never been used
CREATE POLICY "Admins can delete unused tax rates"
    ON public.tax_rates
    FOR DELETE
    USING (public.has_accounting_role(company_id, 'admin'));

-- Comments
COMMENT ON TABLE public.accounting_settings IS 'Per-company accounting configuration and default GL account references.';
COMMENT ON TABLE public.tax_rates IS 'Tax rates for an accounting company. Referenced by invoice/bill line items. Deactivate rather than delete for historical integrity.';
COMMENT ON COLUMN public.tax_rates.rate IS 'Tax rate as a decimal, e.g. 0.0825 for 8.25%';
