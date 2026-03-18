-- Migration 0102: Accounting RLS follow-up fixes
-- Follow-on fixes discovered after 0101 was already applied.

-- Fix 1: Prevent direct draft -> voided updates through the journal_entries table.
-- Posting (draft -> posted) still needs to work through the existing route.
DROP POLICY IF EXISTS "Members can update draft journal entries" ON public.journal_entries;
CREATE POLICY "Members can update draft journal entries"
    ON public.journal_entries
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND status = 'draft'
        AND public.has_accounting_role(company_id, 'member')
    )
    WITH CHECK (
        deleted_at IS NULL
        AND status IN ('draft', 'posted')
        AND public.has_accounting_role(company_id, 'member')
    );

-- Fix 2: Allow admins to soft-delete accounts via UPDATE while still preventing
-- regular members from writing deleted rows.
DROP POLICY IF EXISTS "Members can update accounts" ON public.chart_of_accounts;
CREATE POLICY "Members can update accounts"
    ON public.chart_of_accounts
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND public.has_accounting_role(company_id, 'member')
    )
    WITH CHECK (
        (
            deleted_at IS NULL
            AND public.has_accounting_role(company_id, 'member')
        )
        OR (
            deleted_at IS NOT NULL
            AND public.has_accounting_role(company_id, 'admin')
        )
    );
