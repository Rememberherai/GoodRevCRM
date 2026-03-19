-- Migration 0110: Bank Accounts Bugfixes 2
-- Fixes:
--   1. Keep bank account balances in sync with bank transaction mutations
--   2. Enforce reconciliation item integrity at the DB layer
--   3. Stop reconciliation completion from overwriting current balance
--   4. Enforce admin-only soft delete for bank accounts

-- ============================================================
-- 1. Sync bank account balance from bank transaction mutations
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_bank_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.bank_accounts
        SET current_balance = current_balance + NEW.amount
        WHERE id = NEW.bank_account_id;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        UPDATE public.bank_accounts
        SET current_balance = current_balance - OLD.amount
        WHERE id = OLD.bank_account_id;
        RETURN OLD;
    END IF;

    IF OLD.bank_account_id = NEW.bank_account_id THEN
        UPDATE public.bank_accounts
        SET current_balance = current_balance + (NEW.amount - OLD.amount)
        WHERE id = NEW.bank_account_id;
    ELSE
        UPDATE public.bank_accounts
        SET current_balance = current_balance - OLD.amount
        WHERE id = OLD.bank_account_id;

        UPDATE public.bank_accounts
        SET current_balance = current_balance + NEW.amount
        WHERE id = NEW.bank_account_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_bank_account_balance_trigger ON public.bank_transactions;

CREATE TRIGGER sync_bank_account_balance_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.bank_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_bank_account_balance();

-- ============================================================
-- 2. Validate reconciliation item references and constraints
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_reconciliation_item()
RETURNS TRIGGER AS $$
DECLARE
    v_recon RECORD;
    v_tx RECORD;
BEGIN
    SELECT id, company_id, bank_account_id, statement_date, status
    INTO v_recon
    FROM public.reconciliations
    WHERE id = NEW.reconciliation_id;

    IF v_recon IS NULL THEN
        RAISE EXCEPTION 'Reconciliation not found';
    END IF;

    SELECT id, company_id, bank_account_id, transaction_date, is_reconciled
    INTO v_tx
    FROM public.bank_transactions
    WHERE id = NEW.bank_transaction_id;

    IF v_tx IS NULL THEN
        RAISE EXCEPTION 'Bank transaction not found';
    END IF;

    IF v_recon.status <> 'in_progress' THEN
        RAISE EXCEPTION 'Reconciliation is already completed';
    END IF;

    IF v_tx.company_id <> v_recon.company_id THEN
        RAISE EXCEPTION 'Bank transaction must belong to the same company as the reconciliation';
    END IF;

    IF v_tx.bank_account_id <> v_recon.bank_account_id THEN
        RAISE EXCEPTION 'Bank transaction must belong to the same bank account as the reconciliation';
    END IF;

    IF v_tx.transaction_date > v_recon.statement_date THEN
        RAISE EXCEPTION 'Bank transaction date must be on or before the statement date';
    END IF;

    IF v_tx.is_reconciled THEN
        RAISE EXCEPTION 'Bank transaction is already reconciled';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_reconciliation_item_trigger ON public.reconciliation_items;

CREATE TRIGGER validate_reconciliation_item_trigger
    BEFORE INSERT OR UPDATE ON public.reconciliation_items
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_reconciliation_item();

-- ============================================================
-- 3. Reconciliation completion should not overwrite live current balance
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

    SELECT COALESCE(SUM(bt.amount), 0) INTO v_selected_sum
    FROM public.reconciliation_items ri
    JOIN public.bank_transactions bt ON bt.id = ri.bank_transaction_id
    WHERE ri.reconciliation_id = p_reconciliation_id;

    v_expected := v_recon.statement_ending_balance - v_recon.statement_starting_balance;

    IF v_selected_sum != v_expected THEN
        RAISE EXCEPTION 'Selected total (%) does not match expected (ending % - starting % = %)',
            v_selected_sum, v_recon.statement_ending_balance,
            v_recon.statement_starting_balance, v_expected;
    END IF;

    UPDATE public.bank_transactions
    SET is_reconciled = true
    WHERE id IN (
        SELECT bank_transaction_id
        FROM public.reconciliation_items
        WHERE reconciliation_id = p_reconciliation_id
    );

    UPDATE public.reconciliations
    SET status = 'completed',
        reconciled_balance = v_selected_sum,
        difference = 0,
        completed_at = NOW(),
        completed_by = auth.uid()
    WHERE id = p_reconciliation_id;

    RETURN p_reconciliation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 4. Enforce admin-only bank account soft delete
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_bank_account_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.deleted_at IS NULL
       AND NEW.deleted_at IS NOT NULL
       AND NOT public.has_accounting_role(OLD.company_id, 'admin') THEN
        RAISE EXCEPTION 'Only admins can delete bank accounts';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bank_account_soft_delete_trigger ON public.bank_accounts;

CREATE TRIGGER enforce_bank_account_soft_delete_trigger
    BEFORE UPDATE ON public.bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_bank_account_soft_delete();
