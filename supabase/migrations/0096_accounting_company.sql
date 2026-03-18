-- Migration 096: Accounting company and memberships
-- Top-level tenant for accounting, independent of CRM projects.
-- One set of books per accounting company, shared across all CRM projects.

-- Reuse the same role enum pattern as projects
CREATE TYPE public.accounting_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE IF NOT EXISTS public.accounting_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    base_currency TEXT NOT NULL DEFAULT 'USD',
    fiscal_year_start_month INTEGER NOT NULL DEFAULT 1
        CHECK (fiscal_year_start_month >= 1 AND fiscal_year_start_month <= 12),
    logo_url TEXT,

    -- Document numbering counters (per-company sequential)
    next_invoice_number INTEGER NOT NULL DEFAULT 1001,
    next_bill_number INTEGER NOT NULL DEFAULT 1001,
    next_je_number INTEGER NOT NULL DEFAULT 1,
    invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
    bill_prefix TEXT NOT NULL DEFAULT 'BILL-',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.accounting_companies ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
CREATE TRIGGER set_accounting_companies_updated_at
    BEFORE UPDATE ON public.accounting_companies
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounting_companies_created_by
    ON public.accounting_companies(created_by);
CREATE INDEX IF NOT EXISTS idx_accounting_companies_deleted_at
    ON public.accounting_companies(deleted_at) WHERE deleted_at IS NULL;

-- Memberships table
CREATE TABLE IF NOT EXISTS public.accounting_company_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.accounting_companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role public.accounting_role NOT NULL DEFAULT 'member',
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_accounting_membership UNIQUE (company_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.accounting_company_memberships ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
CREATE TRIGGER set_accounting_company_memberships_updated_at
    BEFORE UPDATE ON public.accounting_company_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounting_memberships_company_id
    ON public.accounting_company_memberships(company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_memberships_user_id
    ON public.accounting_company_memberships(user_id);

-- ============================================================
-- RLS Helper Functions (mirror project pattern from 0004)
-- ============================================================

-- Check if current user is a member of an accounting company
CREATE OR REPLACE FUNCTION public.is_accounting_member(company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.accounting_company_memberships
        WHERE accounting_company_memberships.company_id = is_accounting_member.company_id
        AND accounting_company_memberships.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user has a specific role or higher in an accounting company
CREATE OR REPLACE FUNCTION public.has_accounting_role(company_id UUID, required_role public.accounting_role)
RETURNS BOOLEAN AS $$
DECLARE
    user_role public.accounting_role;
    role_hierarchy INTEGER;
    required_hierarchy INTEGER;
BEGIN
    SELECT role INTO user_role
    FROM public.accounting_company_memberships
    WHERE accounting_company_memberships.company_id = has_accounting_role.company_id
    AND user_id = auth.uid();

    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    role_hierarchy := CASE user_role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'member' THEN 2
        WHEN 'viewer' THEN 1
    END;

    required_hierarchy := CASE required_role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'member' THEN 2
        WHEN 'viewer' THEN 1
    END;

    RETURN role_hierarchy >= required_hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RLS Policies for accounting_companies
-- ============================================================

CREATE POLICY "Members can view their accounting companies"
    ON public.accounting_companies
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.is_accounting_member(id)
    );

CREATE POLICY "Authenticated users can create accounting companies"
    ON public.accounting_companies
    FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
    );

CREATE POLICY "Admins can update accounting companies"
    ON public.accounting_companies
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND public.has_accounting_role(id, 'admin')
    )
    WITH CHECK (
        deleted_at IS NULL
        AND public.has_accounting_role(id, 'admin')
    );

CREATE POLICY "Owners can delete accounting companies"
    ON public.accounting_companies
    FOR DELETE
    USING (
        public.has_accounting_role(id, 'owner')
    );

-- ============================================================
-- RLS Policies for accounting_company_memberships
-- ============================================================

CREATE POLICY "Members can view accounting memberships"
    ON public.accounting_company_memberships
    FOR SELECT
    USING (
        public.is_accounting_member(company_id)
    );

CREATE POLICY "Admins can add accounting members"
    ON public.accounting_company_memberships
    FOR INSERT
    WITH CHECK (
        public.has_accounting_role(company_id, 'admin')
        OR (
            -- Allow creator to join as owner during company creation
            user_id = auth.uid()
            AND role = 'owner'
            AND EXISTS (
                SELECT 1 FROM public.accounting_companies
                WHERE accounting_companies.id = company_id
                AND accounting_companies.created_by = auth.uid()
            )
        )
    );

CREATE POLICY "Admins can update accounting memberships"
    ON public.accounting_company_memberships
    FOR UPDATE
    USING (
        public.has_accounting_role(company_id, 'admin')
    )
    WITH CHECK (
        public.has_accounting_role(company_id, 'admin')
        AND (role != 'owner' OR public.has_accounting_role(company_id, 'owner'))
    );

CREATE POLICY "Admins can remove accounting members"
    ON public.accounting_company_memberships
    FOR DELETE
    USING (
        public.has_accounting_role(company_id, 'admin')
        AND role != 'owner'
    );

CREATE POLICY "Users can leave accounting companies"
    ON public.accounting_company_memberships
    FOR DELETE
    USING (
        user_id = auth.uid()
        AND role != 'owner'
    );

-- ============================================================
-- Auto-create owner membership on company creation
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_accounting_company()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.accounting_company_memberships (company_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_accounting_company_created
    AFTER INSERT ON public.accounting_companies
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_accounting_company();

-- ============================================================
-- Document number allocation functions
-- ============================================================

-- Allocate next invoice number for a company (called within transaction)
CREATE OR REPLACE FUNCTION public.allocate_invoice_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    UPDATE public.accounting_companies
    SET next_invoice_number = next_invoice_number + 1
    WHERE id = p_company_id
    RETURNING invoice_prefix || (next_invoice_number - 1)::text INTO result;

    IF result IS NULL THEN
        RAISE EXCEPTION 'Accounting company not found: %', p_company_id;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allocate next bill number
CREATE OR REPLACE FUNCTION public.allocate_bill_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    UPDATE public.accounting_companies
    SET next_bill_number = next_bill_number + 1
    WHERE id = p_company_id
    RETURNING bill_prefix || (next_bill_number - 1)::text INTO result;

    IF result IS NULL THEN
        RAISE EXCEPTION 'Accounting company not found: %', p_company_id;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allocate next journal entry number
CREATE OR REPLACE FUNCTION public.allocate_je_number(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
    result INTEGER;
BEGIN
    UPDATE public.accounting_companies
    SET next_je_number = next_je_number + 1
    WHERE id = p_company_id
    RETURNING (next_je_number - 1) INTO result;

    IF result IS NULL THEN
        RAISE EXCEPTION 'Accounting company not found: %', p_company_id;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE public.accounting_companies IS 'Top-level tenant for accounting. One set of books per company, shared across CRM projects.';
COMMENT ON TABLE public.accounting_company_memberships IS 'User memberships and roles for accounting companies, independent of CRM project memberships.';
COMMENT ON FUNCTION public.is_accounting_member IS 'Check if current user is a member of the given accounting company.';
COMMENT ON FUNCTION public.has_accounting_role IS 'Check if current user has the required role or higher in the given accounting company.';
COMMENT ON FUNCTION public.allocate_invoice_number IS 'Atomically allocate the next invoice number for a company. Call within a transaction.';
COMMENT ON FUNCTION public.allocate_bill_number IS 'Atomically allocate the next bill number for a company. Call within a transaction.';
COMMENT ON FUNCTION public.allocate_je_number IS 'Atomically allocate the next journal entry number for a company. Call within a transaction.';
