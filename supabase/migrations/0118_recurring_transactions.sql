-- Phase 7: Recurring transactions
-- Supports recurring invoices and bills with configurable frequency

CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.accounting_companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('invoice', 'bill')),

  -- Template metadata
  name TEXT NOT NULL,
  description TEXT,

  -- Counterparty snapshot (works for both invoices and bills)
  organization_id UUID,  -- Optional CRM reference (no DB FK, cross-scope)
  contact_id UUID,
  counterparty_name TEXT NOT NULL,
  counterparty_email TEXT,
  counterparty_address TEXT,

  -- Financial template
  currency TEXT NOT NULL DEFAULT 'USD',
  line_items JSONB NOT NULL DEFAULT '[]'::JSONB,
  notes TEXT,
  footer TEXT,
  project_id UUID,  -- Optional CRM project tag

  -- Recurrence rules
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),
  start_date DATE NOT NULL,
  end_date DATE,
  next_date DATE NOT NULL,
  occurrences_remaining INTEGER,  -- NULL = unlimited

  -- Status and tracking
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  total_generated INTEGER NOT NULL DEFAULT 0,

  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_transactions_select"
  ON public.recurring_transactions FOR SELECT
  USING (public.is_accounting_member(company_id));

CREATE POLICY "recurring_transactions_insert"
  ON public.recurring_transactions FOR INSERT
  WITH CHECK (public.is_accounting_member(company_id));

CREATE POLICY "recurring_transactions_update"
  ON public.recurring_transactions FOR UPDATE
  USING (public.is_accounting_member(company_id));

CREATE POLICY "recurring_transactions_delete"
  ON public.recurring_transactions FOR DELETE
  USING (public.is_accounting_member(company_id));

-- Trigger for updated_at
CREATE TRIGGER set_recurring_transactions_updated_at
  BEFORE UPDATE ON public.recurring_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Index for cron processing
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_next_date
  ON public.recurring_transactions (next_date)
  WHERE is_active = true AND deleted_at IS NULL;

-- Helper: calculate next date given a frequency and current date
CREATE OR REPLACE FUNCTION public.advance_recurring_date(
  p_current_date DATE,
  p_frequency TEXT
) RETURNS DATE AS $$
BEGIN
  RETURN CASE p_frequency
    WHEN 'weekly' THEN p_current_date + INTERVAL '7 days'
    WHEN 'biweekly' THEN p_current_date + INTERVAL '14 days'
    WHEN 'monthly' THEN p_current_date + INTERVAL '1 month'
    WHEN 'quarterly' THEN p_current_date + INTERVAL '3 months'
    WHEN 'annually' THEN p_current_date + INTERVAL '1 year'
    ELSE p_current_date + INTERVAL '1 month'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
