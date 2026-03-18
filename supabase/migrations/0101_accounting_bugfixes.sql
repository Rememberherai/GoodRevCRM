-- Migration 0101: Bug fixes for accounting tables
-- Fixes issues found during Phase 1 code review.

-- Fix 1: Change ON DELETE CASCADE to RESTRICT on journal_entries.created_by
-- Prevents catastrophic deletion of posted journal entries when a user is deleted.
ALTER TABLE public.journal_entries
    DROP CONSTRAINT IF EXISTS journal_entries_created_by_fkey;
ALTER TABLE public.journal_entries
    ADD CONSTRAINT journal_entries_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;

-- Fix 2: Update RLS policy to restrict updates to draft entries only.
-- Voiding (posted->voided) is done via void_journal_entry() SECURITY DEFINER which bypasses RLS.
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
        AND public.has_accounting_role(company_id, 'member')
    );

-- Fix 3: Fix Accounts Payable seed — already deployed with wrong type, fix for existing data.
-- The seed function has been fixed in 0098 source, but any already-seeded data needs correction.
UPDATE public.chart_of_accounts
SET account_type = 'liability'
WHERE account_code = '2000'
AND name = 'Accounts Payable'
AND account_type = 'asset';

-- Fix 4: Change ON DELETE CASCADE to RESTRICT on accounting_companies.created_by
-- Prevents deletion of accounting company records when a user is deleted.
ALTER TABLE public.accounting_companies
    DROP CONSTRAINT IF EXISTS accounting_companies_created_by_fkey;
ALTER TABLE public.accounting_companies
    ADD CONSTRAINT accounting_companies_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;

-- Fix 5: Rewrite void_journal_entry() to:
--   (a) use auth.uid() for reversal created_by instead of copying original creator
--   (b) verify the calling user is a member of the company that owns the entry
-- This prevents any authenticated user from voiding entries via PostgREST RPC.
CREATE OR REPLACE FUNCTION public.void_journal_entry(p_entry_id UUID)
RETURNS UUID AS $$
DECLARE
    original RECORD;
    reversal_id UUID;
    reversal_number INTEGER;
    calling_user UUID;
BEGIN
    calling_user := auth.uid();

    -- Lock and fetch the original entry
    SELECT * INTO original
    FROM public.journal_entries
    WHERE id = p_entry_id
    FOR UPDATE;

    IF original IS NULL THEN
        RAISE EXCEPTION 'Journal entry not found: %', p_entry_id;
    END IF;

    -- Verify the calling user has access to this company
    IF NOT public.has_accounting_role(original.company_id, 'admin') THEN
        RAISE EXCEPTION 'Insufficient permissions to void this journal entry';
    END IF;

    IF original.status != 'posted' THEN
        RAISE EXCEPTION 'Can only void posted journal entries (current status: %)', original.status;
    END IF;

    -- Allocate a new entry number
    reversal_number := public.allocate_je_number(original.company_id);

    -- Create the reversing entry (directly posted)
    INSERT INTO public.journal_entries (
        company_id, entry_number, entry_date, memo, reference,
        source_type, source_id, status, project_id,
        posted_at, created_by
    )
    VALUES (
        original.company_id,
        reversal_number,
        CURRENT_DATE,
        'Reversal of JE-' || original.entry_number || ': ' || COALESCE(original.memo, ''),
        original.reference,
        'reversal',
        original.id,
        'draft',  -- Start as draft, we'll post after adding lines
        original.project_id,
        NULL,
        calling_user  -- Use the current user, not the original creator
    )
    RETURNING id INTO reversal_id;

    -- Copy lines with debits and credits swapped
    INSERT INTO public.journal_entry_lines (
        journal_entry_id, account_id, description,
        debit, credit, currency, exchange_rate,
        base_debit, base_credit, organization_id
    )
    SELECT
        reversal_id, account_id,
        'Reversal: ' || COALESCE(description, ''),
        credit, debit,  -- Swap debit and credit
        currency, exchange_rate,
        base_credit, base_debit,  -- Swap base amounts too
        organization_id
    FROM public.journal_entry_lines
    WHERE journal_entry_id = p_entry_id;

    -- Post the reversal entry (triggers will validate balance)
    UPDATE public.journal_entries
    SET status = 'posted'
    WHERE id = reversal_id;

    -- Void the original entry
    UPDATE public.journal_entries
    SET status = 'voided',
        voided_at = NOW(),
        voided_by_entry_id = reversal_id
    WHERE id = p_entry_id;

    RETURN reversal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 6: Add RLS policy on chart_of_accounts to allow viewing soft-deleted accounts.
-- The trial balance needs to show historical balances for retired/deleted accounts.
-- The existing policy filters deleted_at IS NULL, which hides soft-deleted accounts.
CREATE POLICY "Members can view soft-deleted accounts for reporting"
    ON public.chart_of_accounts
    FOR SELECT
    USING (
        deleted_at IS NOT NULL
        AND public.is_accounting_member(company_id)
    );
