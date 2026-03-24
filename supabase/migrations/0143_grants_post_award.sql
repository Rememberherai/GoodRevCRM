-- Migration 0143: Expand grants table with post-award fields
-- Adds award tracking, match requirements, agreement status, and post-award lifecycle statuses

-- Add post-award columns
ALTER TABLE public.grants
  ADD COLUMN IF NOT EXISTS award_number TEXT,
  ADD COLUMN IF NOT EXISTS funder_grant_id TEXT,
  ADD COLUMN IF NOT EXISTS award_period_start DATE,
  ADD COLUMN IF NOT EXISTS award_period_end DATE,
  ADD COLUMN IF NOT EXISTS total_award_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS match_required NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS match_type TEXT,
  ADD COLUMN IF NOT EXISTS indirect_cost_rate NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS agreement_status TEXT,
  ADD COLUMN IF NOT EXISTS closeout_date DATE,
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_document_id UUID REFERENCES public.contract_documents(id) ON DELETE SET NULL;

-- Add check constraints
ALTER TABLE public.grants
  ADD CONSTRAINT grants_match_type_check
    CHECK (match_type IS NULL OR match_type IN ('cash', 'in_kind', 'either'));

ALTER TABLE public.grants
  ADD CONSTRAINT grants_agreement_status_check
    CHECK (agreement_status IS NULL OR agreement_status IN ('pending', 'executed', 'amended', 'expired'));

-- Expand status to include post-award lifecycle
ALTER TABLE public.grants DROP CONSTRAINT IF EXISTS grants_status_check;
ALTER TABLE public.grants
  ADD CONSTRAINT grants_status_check
    CHECK (status IN ('researching', 'preparing', 'submitted', 'under_review', 'awarded', 'active', 'closed', 'declined'));

-- Index for program linkage
CREATE INDEX IF NOT EXISTS idx_grants_program
  ON public.grants(program_id) WHERE program_id IS NOT NULL;
