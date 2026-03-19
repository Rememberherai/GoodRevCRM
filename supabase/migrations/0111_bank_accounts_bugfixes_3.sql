-- Migration 0111: Bank Accounts Bugfixes 3
-- Fixes:
--   1. Remove unsafe direct member updates on bank transactions
--   2. Remove unsafe direct member updates on reconciliations
--   3. Prevent current_balance tampering and deletion of bank accounts with history

-- ============================================================
-- 1. Bank transactions should not be directly mutable by members
-- ============================================================

DROP POLICY IF EXISTS "Members can update bank transactions" ON public.bank_transactions;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'bank_transactions'
          AND policyname = 'Admins can update bank transactions'
    ) THEN
        CREATE POLICY "Admins can update bank transactions"
            ON public.bank_transactions FOR UPDATE
            USING (public.has_accounting_role(company_id, 'admin'))
            WITH CHECK (public.has_accounting_role(company_id, 'admin'));
    END IF;
END $$;

-- ============================================================
-- 2. Reconciliations should be completed only via RPC, not table UPDATE
-- ============================================================

DROP POLICY IF EXISTS "Members can update reconciliations" ON public.reconciliations;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'reconciliations'
          AND policyname = 'Admins can update reconciliations'
    ) THEN
        CREATE POLICY "Admins can update reconciliations"
            ON public.reconciliations FOR UPDATE
            USING (public.has_accounting_role(company_id, 'admin'))
            WITH CHECK (public.has_accounting_role(company_id, 'admin'));
    END IF;
END $$;

-- ============================================================
-- 3. Protect bank account integrity on update
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_bank_account_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_has_transactions BOOLEAN;
    v_has_reconciliations BOOLEAN;
BEGIN
    IF NEW.current_balance IS DISTINCT FROM OLD.current_balance
       AND pg_trigger_depth() < 2 THEN
        RAISE EXCEPTION 'current_balance is derived from transactions and reconciliation';
    END IF;

    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        IF NOT public.has_accounting_role(OLD.company_id, 'admin') THEN
            RAISE EXCEPTION 'Only admins can delete bank accounts';
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM public.bank_transactions
            WHERE bank_account_id = OLD.id
        ) INTO v_has_transactions;

        SELECT EXISTS (
            SELECT 1 FROM public.reconciliations
            WHERE bank_account_id = OLD.id
        ) INTO v_has_reconciliations;

        IF v_has_transactions OR v_has_reconciliations THEN
            RAISE EXCEPTION 'Cannot delete bank account with transactions or reconciliations';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_bank_account_soft_delete_trigger ON public.bank_accounts;
DROP TRIGGER IF EXISTS protect_bank_account_integrity_trigger ON public.bank_accounts;

CREATE TRIGGER protect_bank_account_integrity_trigger
    BEFORE UPDATE ON public.bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_bank_account_integrity();
