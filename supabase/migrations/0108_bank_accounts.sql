-- Migration 0108: Bank Accounts & Reconciliation (Phase 3)
-- Adds bank account tracking, transaction import/matching, and reconciliation.

-- ============================================================
-- Bank Accounts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.accounting_companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    institution TEXT,
    account_number_last4 TEXT,
    account_type TEXT NOT NULL DEFAULT 'checking'
        CHECK (account_type IN ('checking', 'savings', 'credit_card', 'other')),
    currency TEXT NOT NULL DEFAULT 'USD',
    current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON public.bank_accounts(company_id) WHERE deleted_at IS NULL;

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view bank accounts"
    ON public.bank_accounts FOR SELECT
    USING (deleted_at IS NULL AND public.is_accounting_member(company_id));

CREATE POLICY "Members can create bank accounts"
    ON public.bank_accounts FOR INSERT
    WITH CHECK (public.has_accounting_role(company_id, 'member'));

CREATE POLICY "Members can update bank accounts"
    ON public.bank_accounts FOR UPDATE
    USING (deleted_at IS NULL AND public.has_accounting_role(company_id, 'member'))
    WITH CHECK (public.has_accounting_role(company_id, 'member'));

CREATE POLICY "Admins can delete bank accounts"
    ON public.bank_accounts FOR DELETE
    USING (public.has_accounting_role(company_id, 'admin'));

CREATE TRIGGER handle_bank_accounts_updated_at
    BEFORE UPDATE ON public.bank_accounts
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- Bank Transactions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.accounting_companies(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    transaction_type TEXT NOT NULL DEFAULT 'deposit'
        CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer', 'fee', 'interest')),
    reference TEXT,
    is_reconciled BOOLEAN NOT NULL DEFAULT false,
    matched_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    matched_journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    import_source TEXT NOT NULL DEFAULT 'manual'
        CHECK (import_source IN ('manual', 'csv')),
    import_batch_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON public.bank_transactions(bank_account_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_company ON public.bank_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_batch ON public.bank_transactions(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_transactions_reconciled ON public.bank_transactions(bank_account_id, is_reconciled) WHERE NOT is_reconciled;

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view bank transactions"
    ON public.bank_transactions FOR SELECT
    USING (public.is_accounting_member(company_id));

CREATE POLICY "Members can create bank transactions"
    ON public.bank_transactions FOR INSERT
    WITH CHECK (public.has_accounting_role(company_id, 'member'));

CREATE POLICY "Members can update bank transactions"
    ON public.bank_transactions FOR UPDATE
    USING (public.has_accounting_role(company_id, 'member'))
    WITH CHECK (public.has_accounting_role(company_id, 'member'));

CREATE POLICY "Admins can delete bank transactions"
    ON public.bank_transactions FOR DELETE
    USING (public.has_accounting_role(company_id, 'admin'));

CREATE TRIGGER handle_bank_transactions_updated_at
    BEFORE UPDATE ON public.bank_transactions
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- Reconciliations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.accounting_companies(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    statement_date DATE NOT NULL,
    statement_ending_balance DECIMAL(15,2) NOT NULL,
    reconciled_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    difference DECIMAL(15,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed')),
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliations_account ON public.reconciliations(bank_account_id, statement_date DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliations_company ON public.reconciliations(company_id);

ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view reconciliations"
    ON public.reconciliations FOR SELECT
    USING (public.is_accounting_member(company_id));

CREATE POLICY "Members can create reconciliations"
    ON public.reconciliations FOR INSERT
    WITH CHECK (public.has_accounting_role(company_id, 'member'));

CREATE POLICY "Members can update reconciliations"
    ON public.reconciliations FOR UPDATE
    USING (public.has_accounting_role(company_id, 'member'))
    WITH CHECK (public.has_accounting_role(company_id, 'member'));

ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER handle_reconciliations_updated_at
    BEFORE UPDATE ON public.reconciliations
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- Reconciliation Items (tracks which transactions are included in a reconciliation)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reconciliation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id UUID NOT NULL REFERENCES public.reconciliations(id) ON DELETE CASCADE,
    bank_transaction_id UUID NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(reconciliation_id, bank_transaction_id)
);

ALTER TABLE public.reconciliation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage reconciliation items"
    ON public.reconciliation_items FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.reconciliations r
        WHERE r.id = reconciliation_id
        AND public.is_accounting_member(r.company_id)
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.reconciliations r
        WHERE r.id = reconciliation_id
        AND public.has_accounting_role(r.company_id, 'member')
    ));

-- ============================================================
-- Complete reconciliation RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_reconciliation(
    p_reconciliation_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_recon RECORD;
    v_reconciled_sum DECIMAL(15,2);
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_recon
    FROM public.reconciliations
    WHERE id = p_reconciliation_id
    FOR UPDATE;

    IF v_recon IS NULL THEN
        RAISE EXCEPTION 'Reconciliation not found';
    END IF;

    IF NOT public.has_accounting_role(v_recon.company_id, 'member') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    IF v_recon.status = 'completed' THEN
        RAISE EXCEPTION 'Reconciliation is already completed';
    END IF;

    -- Calculate the reconciled balance from selected transactions
    SELECT COALESCE(SUM(bt.amount), 0) INTO v_reconciled_sum
    FROM public.reconciliation_items ri
    JOIN public.bank_transactions bt ON bt.id = ri.bank_transaction_id
    WHERE ri.reconciliation_id = p_reconciliation_id;

    -- Check if it balances
    IF v_reconciled_sum != v_recon.statement_ending_balance THEN
        RAISE EXCEPTION 'Reconciled balance (%) does not match statement ending balance (%)',
            v_reconciled_sum, v_recon.statement_ending_balance;
    END IF;

    -- Mark all included transactions as reconciled
    UPDATE public.bank_transactions
    SET is_reconciled = true
    WHERE id IN (
        SELECT bank_transaction_id
        FROM public.reconciliation_items
        WHERE reconciliation_id = p_reconciliation_id
    );

    -- Complete the reconciliation
    UPDATE public.reconciliations
    SET status = 'completed',
        reconciled_balance = v_reconciled_sum,
        difference = 0,
        completed_at = NOW(),
        completed_by = auth.uid()
    WHERE id = p_reconciliation_id;

    -- Update bank account current_balance
    UPDATE public.bank_accounts
    SET current_balance = v_recon.statement_ending_balance
    WHERE id = v_recon.bank_account_id;

    RETURN p_reconciliation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON TABLE public.bank_accounts IS 'Bank accounts linked to GL asset accounts for reconciliation.';
COMMENT ON TABLE public.bank_transactions IS 'Individual bank transactions imported manually or via CSV for reconciliation matching.';
COMMENT ON TABLE public.reconciliations IS 'Bank statement reconciliation sessions.';
COMMENT ON TABLE public.reconciliation_items IS 'Transactions included in a reconciliation session.';
COMMENT ON FUNCTION public.complete_reconciliation IS 'Completes a reconciliation: validates balance match, marks transactions reconciled, updates bank account balance.';
