-- Migration 0109: Bank Accounts & Reconciliation Bugfixes
-- Fixes:
--   1. complete_reconciliation RPC: use starting balance for correct difference calc
--   2. Partial unique index to prevent duplicate in-progress reconciliations
--   3. DELETE policy on reconciliations table (was missing)
--   4. Remove duplicate ENABLE ROW LEVEL SECURITY on reconciliations

-- ============================================================
-- 1. Add statement_starting_balance to reconciliations
-- ============================================================

ALTER TABLE public.reconciliations
    ADD COLUMN IF NOT EXISTS statement_starting_balance DECIMAL(15,2) NOT NULL DEFAULT 0;

-- ============================================================
-- 2. Partial unique index: only one in-progress reconciliation per bank account
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_reconciliations_one_in_progress
    ON public.reconciliations(bank_account_id)
    WHERE status = 'in_progress';

-- ============================================================
-- 3. Add DELETE policy on reconciliations (admins only)
-- ============================================================

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'reconciliations'
          AND policyname = 'Admins can delete reconciliations'
    ) THEN
        CREATE POLICY "Admins can delete reconciliations"
            ON public.reconciliations FOR DELETE
            USING (public.has_accounting_role(company_id, 'admin'));
    END IF;
END $$;

-- ============================================================
-- 4. Fix complete_reconciliation RPC
--    Correct logic: starting_balance + selected_total = ending_balance
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_reconciliation(
    p_reconciliation_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_recon RECORD;
    v_selected_sum DECIMAL(15,2);
    v_expected DECIMAL(15,2);
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

    -- Calculate the sum of selected transactions
    SELECT COALESCE(SUM(bt.amount), 0) INTO v_selected_sum
    FROM public.reconciliation_items ri
    JOIN public.bank_transactions bt ON bt.id = ri.bank_transaction_id
    WHERE ri.reconciliation_id = p_reconciliation_id;

    -- The expected sum of selected transactions is:
    -- ending_balance - starting_balance
    v_expected := v_recon.statement_ending_balance - v_recon.statement_starting_balance;

    IF v_selected_sum != v_expected THEN
        RAISE EXCEPTION 'Selected total (%) does not match expected (ending % - starting % = %)',
            v_selected_sum, v_recon.statement_ending_balance,
            v_recon.statement_starting_balance, v_expected;
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
        reconciled_balance = v_selected_sum,
        difference = 0,
        completed_at = NOW(),
        completed_by = auth.uid()
    WHERE id = p_reconciliation_id;

    -- Update bank account current_balance to the statement ending balance
    UPDATE public.bank_accounts
    SET current_balance = v_recon.statement_ending_balance
    WHERE id = v_recon.bank_account_id;

    RETURN p_reconciliation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
