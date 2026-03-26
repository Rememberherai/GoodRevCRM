-- Migration 0155: Add strategic planning fields to grants table
-- Adds category, funding range, mission fit, tier, urgency, key intel,
-- recommended strategy, and application URL fields.

ALTER TABLE public.grants
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS funding_range_min NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS funding_range_max NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS mission_fit SMALLINT,
  ADD COLUMN IF NOT EXISTS tier SMALLINT,
  ADD COLUMN IF NOT EXISTS key_intel TEXT,
  ADD COLUMN IF NOT EXISTS recommended_strategy TEXT,
  ADD COLUMN IF NOT EXISTS application_url TEXT,
  ADD COLUMN IF NOT EXISTS urgency TEXT;

-- Constraints
ALTER TABLE public.grants
  ADD CONSTRAINT grants_category_check
    CHECK (category IS NULL OR category IN ('federal', 'state', 'corporate', 'foundation', 'individual'));

ALTER TABLE public.grants
  ADD CONSTRAINT grants_mission_fit_check
    CHECK (mission_fit IS NULL OR (mission_fit >= 1 AND mission_fit <= 5));

ALTER TABLE public.grants
  ADD CONSTRAINT grants_tier_check
    CHECK (tier IS NULL OR (tier >= 1 AND tier <= 3));

ALTER TABLE public.grants
  ADD CONSTRAINT grants_urgency_check
    CHECK (urgency IS NULL OR urgency IN ('low', 'medium', 'high', 'critical'));

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_grants_category ON public.grants (project_id, category) WHERE category IS NOT NULL;

-- Index for tier/urgency filtering
CREATE INDEX IF NOT EXISTS idx_grants_tier ON public.grants (project_id, tier) WHERE tier IS NOT NULL;
