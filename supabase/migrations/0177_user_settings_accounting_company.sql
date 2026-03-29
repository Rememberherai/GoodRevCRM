-- BUG-BO: Add selected_accounting_company_id to user_settings so users
-- with multiple accounting company memberships can switch between them.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS selected_accounting_company_id uuid
    REFERENCES public.accounting_companies(id) ON DELETE SET NULL;
