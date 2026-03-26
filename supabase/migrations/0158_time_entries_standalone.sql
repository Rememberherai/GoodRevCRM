-- Migration: Make job_time_entries support standalone (non-job) time entries
-- Adds contractor_id and category columns, makes job_id nullable,
-- backfills contractor_id from parent jobs, and updates RLS policies.

-- 1. Extend schema (idempotent)
-- Make job_id nullable if it isn't already
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_time_entries'
      AND column_name = 'job_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.job_time_entries ALTER COLUMN job_id DROP NOT NULL;
  END IF;
END $$;
ALTER TABLE public.job_time_entries
  ADD COLUMN IF NOT EXISTS contractor_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (char_length(category) <= 100);

-- 2. Index for contractor-based lookups
CREATE INDEX IF NOT EXISTS job_time_entries_contractor_id_idx
  ON public.job_time_entries(contractor_id);

-- 3. Backfill contractor_id from parent jobs (MUST run before constraint below)
UPDATE public.job_time_entries jte
SET contractor_id = j.contractor_id
FROM public.jobs j
WHERE jte.job_id = j.id AND j.contractor_id IS NOT NULL;

-- 4. Context constraint: every row must have at least one anchor
ALTER TABLE public.job_time_entries
  DROP CONSTRAINT IF EXISTS time_entries_must_have_context,
  ADD CONSTRAINT time_entries_must_have_context
    CHECK (job_id IS NOT NULL OR contractor_id IS NOT NULL);

-- 5. Replace single RLS policy with two targeted ones
DROP POLICY IF EXISTS job_time_entries_access ON public.job_time_entries;

-- Job-linked entries: permission flows through the job's project
CREATE POLICY job_time_entries_via_job ON public.job_time_entries
  FOR ALL USING (
    job_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_time_entries.job_id
        AND public.community_has_permission(j.project_id, 'jobs', 'view')
    )
  );

-- Standalone entries: contractor sees own; staff/admin see via people.project_id
-- people.project_id confirmed to exist (see idx_people_project_user_id_unique in 0133)
CREATE POLICY job_time_entries_via_contractor ON public.job_time_entries
  FOR ALL USING (
    job_id IS NULL AND (
      -- The contractor sees their own entries
      EXISTS (
        SELECT 1 FROM public.people p
        WHERE p.id = job_time_entries.contractor_id
          AND p.user_id = auth.uid()
      )
      OR
      -- Staff/admin see all standalone entries for their project
      EXISTS (
        SELECT 1 FROM public.people p
        WHERE p.id = job_time_entries.contractor_id
          AND public.community_has_permission(p.project_id, 'jobs', 'view')
      )
    )
  );

-- Trigger (idempotent)
DROP TRIGGER IF EXISTS set_job_time_entries_updated_at ON public.job_time_entries;
CREATE TRIGGER set_job_time_entries_updated_at
  BEFORE UPDATE ON public.job_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
