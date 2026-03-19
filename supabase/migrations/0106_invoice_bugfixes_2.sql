-- Migration 0106: Invoice bugfixes round 2
-- Fixes found during second Phase 2 bug sweep.

-- Fix 1: Add status = 'draft' to WITH CHECK on member update policy.
-- Without this, a member could change a draft invoice's status to non-draft
-- via direct PostgREST call (USING requires draft, but WITH CHECK didn't).
DROP POLICY IF EXISTS "Members can update draft invoices" ON public.invoices;
CREATE POLICY "Members can update draft invoices"
    ON public.invoices
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND status = 'draft'
        AND public.has_accounting_role(company_id, 'member')
    )
    WITH CHECK (
        deleted_at IS NULL
        AND status = 'draft'
        AND public.has_accounting_role(company_id, 'member')
    );

-- Fix 2: Add missing index for payment lookups by invoice_id.
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id) WHERE deleted_at IS NULL;
