-- Migration 0099: Journal Entries
-- Core double-entry bookkeeping engine with correctness enforcement triggers.
-- Posted entries are immutable. Voiding creates a reversing entry.

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.accounting_companies(id) ON DELETE CASCADE,
    entry_number INTEGER NOT NULL,
    entry_date DATE NOT NULL,
    memo TEXT,
    reference TEXT,
    source_type TEXT CHECK (source_type IN ('manual', 'invoice', 'bill', 'payment', 'adjustment', 'reversal')),
    source_id UUID,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'voided')),
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    posted_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    voided_by_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT unique_je_number_per_company UNIQUE (company_id, entry_number)
);

-- Enable RLS
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Triggers
CREATE TRIGGER set_journal_entries_updated_at
    BEFORE UPDATE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_id
    ON public.journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_date
    ON public.journal_entries(company_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status
    ON public.journal_entries(company_id, status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source
    ON public.journal_entries(source_type, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_project
    ON public.journal_entries(project_id) WHERE project_id IS NOT NULL;

-- ============================================================
-- Journal Entry Lines
-- ============================================================

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
    description TEXT,
    debit DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    exchange_rate DECIMAL(15,6) NOT NULL DEFAULT 1.0,
    base_debit DECIMAL(15,2) NOT NULL DEFAULT 0,
    base_credit DECIMAL(15,2) NOT NULL DEFAULT 0,
    organization_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each line must be either a debit or a credit (or zero/zero for placeholder)
    CONSTRAINT je_line_debit_or_credit CHECK (
        (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) OR (debit = 0 AND credit = 0)
    )
);

-- Enable RLS
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_je_lines_entry_id
    ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_je_lines_account_id
    ON public.journal_entry_lines(account_id);

-- ============================================================
-- RLS Policies for journal_entries
-- ============================================================

CREATE POLICY "Members can view journal entries"
    ON public.journal_entries
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.is_accounting_member(company_id)
    );

CREATE POLICY "Members can create journal entries"
    ON public.journal_entries
    FOR INSERT
    WITH CHECK (
        public.has_accounting_role(company_id, 'member')
    );

-- RLS only allows updating draft entries. Posting (draft->posted) goes through this policy
-- since the USING checks the OLD row (which is draft). Voiding (posted->voided) is done
-- via void_journal_entry() which is SECURITY DEFINER and bypasses RLS.
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

CREATE POLICY "Admins can delete draft journal entries"
    ON public.journal_entries
    FOR DELETE
    USING (
        public.has_accounting_role(company_id, 'admin')
        AND status = 'draft'
    );

-- ============================================================
-- RLS Policies for journal_entry_lines
-- ============================================================

CREATE POLICY "Members can view journal entry lines"
    ON public.journal_entry_lines
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.journal_entries je
            WHERE je.id = journal_entry_id
            AND je.deleted_at IS NULL
            AND public.is_accounting_member(je.company_id)
        )
    );

CREATE POLICY "Members can create journal entry lines"
    ON public.journal_entry_lines
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.journal_entries je
            WHERE je.id = journal_entry_id
            AND je.status = 'draft'
            AND public.has_accounting_role(je.company_id, 'member')
        )
    );

CREATE POLICY "Members can update draft journal entry lines"
    ON public.journal_entry_lines
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.journal_entries je
            WHERE je.id = journal_entry_id
            AND je.status = 'draft'
            AND public.has_accounting_role(je.company_id, 'member')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.journal_entries je
            WHERE je.id = journal_entry_id
            AND je.status = 'draft'
            AND public.has_accounting_role(je.company_id, 'member')
        )
    );

CREATE POLICY "Members can delete draft journal entry lines"
    ON public.journal_entry_lines
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.journal_entries je
            WHERE je.id = journal_entry_id
            AND je.status = 'draft'
            AND public.has_accounting_role(je.company_id, 'member')
        )
    );

-- ============================================================
-- Correctness Control 1: Balance check on posting
-- Verify SUM(base_debit) = SUM(base_credit) when status changes to 'posted'
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_je_balance_on_post()
RETURNS TRIGGER AS $$
DECLARE
    total_debit DECIMAL(15,2);
    total_credit DECIMAL(15,2);
    line_count INTEGER;
BEGIN
    -- Only check when status is changing to 'posted'
    IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
        SELECT COALESCE(SUM(base_debit), 0), COALESCE(SUM(base_credit), 0), COUNT(*)
        INTO total_debit, total_credit, line_count
        FROM public.journal_entry_lines
        WHERE journal_entry_id = NEW.id;

        -- Minimum 2 lines
        IF line_count < 2 THEN
            RAISE EXCEPTION 'Journal entry must have at least 2 lines to be posted (has %)', line_count;
        END IF;

        -- Debits must equal credits
        IF total_debit != total_credit THEN
            RAISE EXCEPTION 'Journal entry is unbalanced: debits (%) != credits (%)', total_debit, total_credit;
        END IF;

        -- Set posted_at timestamp
        NEW.posted_at := NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_je_balance_before_post
    BEFORE UPDATE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.check_je_balance_on_post();

-- ============================================================
-- Correctness Control 2: Immutability of posted entry lines
-- Reject INSERT/UPDATE/DELETE on lines if parent JE is posted or voided
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_posted_je_lines()
RETURNS TRIGGER AS $$
DECLARE
    je_status TEXT;
BEGIN
    -- For DELETE, use OLD; for INSERT/UPDATE, use NEW
    IF TG_OP = 'DELETE' THEN
        SELECT status INTO je_status FROM public.journal_entries WHERE id = OLD.journal_entry_id;
    ELSE
        SELECT status INTO je_status FROM public.journal_entries WHERE id = NEW.journal_entry_id;
    END IF;

    IF je_status IN ('posted', 'voided') THEN
        RAISE EXCEPTION 'Cannot modify lines of a % journal entry', je_status;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_posted_je_lines_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_posted_je_lines();

-- ============================================================
-- Correctness Control 3: Immutability of posted entry header
-- Only status, voided_at, voided_by_entry_id, updated_at can change on posted entries
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_posted_je_header()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('posted', 'voided') THEN
        -- Allow status transition: posted -> voided
        IF OLD.status = 'posted' AND NEW.status = 'voided' THEN
            -- Only allow changing status, voided_at, voided_by_entry_id, updated_at
            IF NEW.entry_date != OLD.entry_date
                OR NEW.memo IS DISTINCT FROM OLD.memo
                OR NEW.reference IS DISTINCT FROM OLD.reference
                OR NEW.source_type IS DISTINCT FROM OLD.source_type
                OR NEW.source_id IS DISTINCT FROM OLD.source_id
                OR NEW.project_id IS DISTINCT FROM OLD.project_id
                OR NEW.entry_number != OLD.entry_number
            THEN
                RAISE EXCEPTION 'Cannot modify fields of a posted journal entry (only status, voided_at, voided_by_entry_id may change)';
            END IF;
            RETURN NEW;
        END IF;

        -- Allow updated_at changes (from trigger)
        IF NEW.status = OLD.status
            AND NEW.entry_date = OLD.entry_date
            AND NEW.memo IS NOT DISTINCT FROM OLD.memo
            AND NEW.reference IS NOT DISTINCT FROM OLD.reference
            AND NEW.source_type IS NOT DISTINCT FROM OLD.source_type
            AND NEW.source_id IS NOT DISTINCT FROM OLD.source_id
            AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id
            AND NEW.entry_number = OLD.entry_number
        THEN
            RETURN NEW;
        END IF;

        RAISE EXCEPTION 'Cannot modify a % journal entry', OLD.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_posted_je_header_trigger
    BEFORE UPDATE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_posted_je_header();

-- ============================================================
-- Correctness Control 4: Void creates reversing entry
-- ============================================================

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

-- ============================================================
-- Correctness Control 5: Idempotent document-to-JE linkage
-- Prevent duplicate JEs for the same source document
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_duplicate_source_je()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.source_type IS NOT NULL AND NEW.source_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.journal_entries
            WHERE source_type = NEW.source_type
            AND source_id = NEW.source_id
            AND status != 'voided'
            AND id != NEW.id
            AND deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'A non-voided journal entry already exists for % %', NEW.source_type, NEW.source_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_duplicate_source_je_trigger
    BEFORE INSERT OR UPDATE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.check_duplicate_source_je();

-- ============================================================
-- Auto-compute base amounts on line insert/update
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_je_line_base_amounts()
RETURNS TRIGGER AS $$
BEGIN
    NEW.base_debit := ROUND(NEW.debit * NEW.exchange_rate, 2);
    NEW.base_credit := ROUND(NEW.credit * NEW.exchange_rate, 2);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER compute_je_line_base_amounts_trigger
    BEFORE INSERT OR UPDATE ON public.journal_entry_lines
    FOR EACH ROW
    EXECUTE FUNCTION public.compute_je_line_base_amounts();

-- Comments
COMMENT ON TABLE public.journal_entries IS 'Double-entry journal entries. Posted entries are immutable; voided entries have reversing entries.';
COMMENT ON TABLE public.journal_entry_lines IS 'Individual debit/credit lines within a journal entry.';
COMMENT ON FUNCTION public.void_journal_entry IS 'Voids a posted journal entry by creating a reversing entry and marking the original as voided.';
COMMENT ON FUNCTION public.check_je_balance_on_post IS 'Validates that debits = credits and at least 2 lines exist before posting.';
