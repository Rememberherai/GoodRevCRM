-- Phase 6: Add accounting-related fields to organizations for CRM <-> Accounting integration
-- These fields allow organizations to serve as both customers (invoices) and vendors (bills).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_customer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vendor BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_terms INTEGER,
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS default_tax_rate_id UUID,  -- Cross-scope ref to tax_rates (no DB FK, validated at app layer)
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS billing_address JSONB;

-- Index for quickly finding all customers or vendors
CREATE INDEX IF NOT EXISTS idx_organizations_is_customer
  ON public.organizations (project_id, is_customer)
  WHERE is_customer = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_is_vendor
  ON public.organizations (project_id, is_vendor)
  WHERE is_vendor = true AND deleted_at IS NULL;
