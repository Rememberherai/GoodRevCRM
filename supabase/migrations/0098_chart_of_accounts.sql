-- Migration 0098: Chart of Accounts
-- Double-entry bookkeeping foundation. Each account has a type, subtype, and normal balance.
-- Hierarchical via parent_id. System-seeded accounts are protected from deletion.

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.accounting_companies(id) ON DELETE CASCADE,
    account_code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    account_subtype TEXT,
    parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    is_system BOOLEAN NOT NULL DEFAULT false,
    normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
    currency TEXT NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT unique_account_code_per_company UNIQUE (company_id, account_code)
);

-- Enable RLS
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Triggers
CREATE TRIGGER set_chart_of_accounts_updated_at
    BEFORE UPDATE ON public.chart_of_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_company_id
    ON public.chart_of_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent_id
    ON public.chart_of_accounts(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type
    ON public.chart_of_accounts(company_id, account_type);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_active
    ON public.chart_of_accounts(company_id) WHERE is_active = true AND deleted_at IS NULL;

-- ============================================================
-- RLS Policies
-- ============================================================

CREATE POLICY "Members can view chart of accounts"
    ON public.chart_of_accounts
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.is_accounting_member(company_id)
    );

CREATE POLICY "Members can create accounts"
    ON public.chart_of_accounts
    FOR INSERT
    WITH CHECK (
        public.has_accounting_role(company_id, 'member')
    );

CREATE POLICY "Members can update accounts"
    ON public.chart_of_accounts
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND public.has_accounting_role(company_id, 'member')
    )
    WITH CHECK (
        deleted_at IS NULL
        AND public.has_accounting_role(company_id, 'member')
    );

CREATE POLICY "Admins can delete accounts"
    ON public.chart_of_accounts
    FOR DELETE
    USING (
        public.has_accounting_role(company_id, 'admin')
        AND is_system = false
    );

-- ============================================================
-- Prevent deletion of system accounts
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_system_account_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_system = true THEN
        RAISE EXCEPTION 'Cannot delete system account: %', OLD.name;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_system_account_deletion
    BEFORE DELETE ON public.chart_of_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_system_account_delete();

-- ============================================================
-- Seed default chart of accounts for a new company
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_default_accounts(p_company_id UUID)
RETURNS void AS $$
BEGIN
    -- Assets (normal_balance = debit)
    INSERT INTO public.chart_of_accounts (company_id, account_code, name, account_type, account_subtype, normal_balance, is_system)
    VALUES
        (p_company_id, '1000', 'Cash', 'asset', 'cash', 'debit', true),
        (p_company_id, '1100', 'Accounts Receivable', 'asset', 'accounts_receivable', 'debit', true),
        (p_company_id, '1200', 'Inventory', 'asset', 'inventory', 'debit', true),
        (p_company_id, '1300', 'Prepaid Expenses', 'asset', 'prepaid', 'debit', true),
        (p_company_id, '1500', 'Equipment', 'asset', 'fixed_asset', 'debit', true),
        (p_company_id, '1510', 'Accumulated Depreciation', 'asset', 'contra_asset', 'credit', true)
    ON CONFLICT (company_id, account_code) DO NOTHING;

    -- Liabilities (normal_balance = credit)
    INSERT INTO public.chart_of_accounts (company_id, account_code, name, account_type, account_subtype, normal_balance, is_system)
    VALUES
        (p_company_id, '2000', 'Accounts Payable', 'liability', 'accounts_payable', 'credit', true),
        (p_company_id, '2100', 'Credit Card Payable', 'liability', 'credit_card', 'credit', true),
        (p_company_id, '2200', 'Tax Liability', 'liability', 'tax_payable', 'credit', true),
        (p_company_id, '2300', 'Accrued Liabilities', 'liability', 'accrued', 'credit', true)
    ON CONFLICT (company_id, account_code) DO NOTHING;

    -- Equity (normal_balance = credit)
    INSERT INTO public.chart_of_accounts (company_id, account_code, name, account_type, account_subtype, normal_balance, is_system)
    VALUES
        (p_company_id, '3000', 'Owner''s Equity', 'equity', 'owners_equity', 'credit', true),
        (p_company_id, '3200', 'Retained Earnings', 'equity', 'retained_earnings', 'credit', true)
    ON CONFLICT (company_id, account_code) DO NOTHING;

    -- Revenue (normal_balance = credit)
    INSERT INTO public.chart_of_accounts (company_id, account_code, name, account_type, account_subtype, normal_balance, is_system)
    VALUES
        (p_company_id, '4000', 'Sales Revenue', 'revenue', 'sales', 'credit', true),
        (p_company_id, '4100', 'Service Revenue', 'revenue', 'service', 'credit', true)
    ON CONFLICT (company_id, account_code) DO NOTHING;

    -- Expenses (normal_balance = debit)
    INSERT INTO public.chart_of_accounts (company_id, account_code, name, account_type, account_subtype, normal_balance, is_system)
    VALUES
        (p_company_id, '5000', 'Cost of Goods Sold', 'expense', 'cogs', 'debit', true),
        (p_company_id, '5100', 'Salaries & Wages', 'expense', 'payroll', 'debit', true),
        (p_company_id, '5200', 'Rent Expense', 'expense', 'rent', 'debit', true),
        (p_company_id, '5300', 'Utilities', 'expense', 'utilities', 'debit', true),
        (p_company_id, '5400', 'Office Supplies', 'expense', 'supplies', 'debit', true),
        (p_company_id, '5500', 'Marketing & Advertising', 'expense', 'marketing', 'debit', true),
        (p_company_id, '5600', 'Professional Fees', 'expense', 'professional', 'debit', true),
        (p_company_id, '5700', 'Depreciation Expense', 'expense', 'depreciation', 'debit', true),
        (p_company_id, '5800', 'Interest Expense', 'expense', 'interest', 'debit', true),
        (p_company_id, '5900', 'Foreign Exchange Gain/Loss', 'expense', 'fx_gain_loss', 'debit', true),
        (p_company_id, '5950', 'Miscellaneous Expense', 'expense', 'miscellaneous', 'debit', true)
    ON CONFLICT (company_id, account_code) DO NOTHING;

    -- Update accounting_settings with default account references
    UPDATE public.accounting_settings
    SET
        default_revenue_account_id = (SELECT id FROM public.chart_of_accounts WHERE company_id = p_company_id AND account_code = '4000'),
        default_expense_account_id = (SELECT id FROM public.chart_of_accounts WHERE company_id = p_company_id AND account_code = '5000'),
        default_ar_account_id = (SELECT id FROM public.chart_of_accounts WHERE company_id = p_company_id AND account_code = '1100'),
        default_ap_account_id = (SELECT id FROM public.chart_of_accounts WHERE company_id = p_company_id AND account_code = '2000'),
        default_cash_account_id = (SELECT id FROM public.chart_of_accounts WHERE company_id = p_company_id AND account_code = '1000'),
        default_tax_liability_account_id = (SELECT id FROM public.chart_of_accounts WHERE company_id = p_company_id AND account_code = '2200'),
        default_fx_gain_loss_account_id = (SELECT id FROM public.chart_of_accounts WHERE company_id = p_company_id AND account_code = '5900')
    WHERE company_id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE public.chart_of_accounts IS 'Chart of accounts for double-entry bookkeeping. Hierarchical, per-company.';
COMMENT ON FUNCTION public.seed_default_accounts IS 'Seeds ~25 standard accounts for a new accounting company and sets default account references in settings.';
