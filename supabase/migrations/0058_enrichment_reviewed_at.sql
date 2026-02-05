-- Add reviewed_at column to enrichment_jobs so we can track whether the user
-- has already seen/dismissed enrichment results (prevents auto-pop on every page load).
ALTER TABLE enrichment_jobs ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
