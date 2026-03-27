-- Migration 0159: Employee time tracking
-- Adds is_employee flag, kiosk PIN (HMAC), person_id on time entries,
-- entry_source tracking, audit log, kiosk punch log, and updated RLS.

-- 1. Extend job_time_entries with person_id and entry_source
ALTER TABLE public.job_time_entries
  ADD COLUMN IF NOT EXISTS person_id    UUID REFERENCES public.people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entry_source TEXT CHECK (entry_source IN ('job_tracker', 'portal', 'kiosk', 'admin', 'legacy'))
                                        DEFAULT 'admin';

-- Backfill person_id from contractor_id (dual-write going forward)
UPDATE public.job_time_entries
SET person_id = contractor_id
WHERE contractor_id IS NOT NULL AND person_id IS NULL;

-- Backfill entry_source conservatively: existing rows are 'legacy' (unknown provenance)
-- New entries will receive explicit source values from API routes
UPDATE public.job_time_entries
SET entry_source = 'legacy'
WHERE entry_source IS NULL OR entry_source = 'admin';

CREATE INDEX IF NOT EXISTS job_time_entries_person_id_idx ON public.job_time_entries(person_id);

-- 2. Add employee fields to people
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS is_employee     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kiosk_pin_hmac  TEXT;  -- HMAC(project_id:pin, KIOSK_PIN_SECRET), never stores raw PIN

CREATE UNIQUE INDEX IF NOT EXISTS people_project_kiosk_pin_hmac_unique
  ON public.people(project_id, kiosk_pin_hmac)
  WHERE kiosk_pin_hmac IS NOT NULL AND is_employee = TRUE;

CREATE INDEX IF NOT EXISTS people_is_employee_idx
  ON public.people(project_id, is_employee) WHERE is_employee = TRUE;

-- 3. Audit log for time entry mutations (payroll-authoritative requires immutable history)
CREATE TABLE IF NOT EXISTS public.time_entry_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id   UUID NOT NULL,           -- kept even after deletion
  project_id      UUID NOT NULL,
  person_id       UUID,
  action          TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  changed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_role TEXT,                    -- snapshot of role at time of change
  entry_source    TEXT,
  old_data        JSONB,
  new_data        JSONB,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS time_entry_audit_entry_idx   ON public.time_entry_audit(time_entry_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS time_entry_audit_project_idx ON public.time_entry_audit(project_id, changed_at DESC);

-- RLS: admins/owners only (project_memberships has no deleted_at — memberships are hard-deleted)
ALTER TABLE public.time_entry_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY time_entry_audit_admin ON public.time_entry_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_memberships pm
      WHERE pm.project_id = time_entry_audit.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin', 'owner')
    )
  );

-- 4. Kiosk punch log (separate from audit — tracks device-level events)
CREATE TABLE IF NOT EXISTS public.kiosk_punches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  person_id      UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  action         TEXT NOT NULL CHECK (action IN ('in', 'out')),
  punched_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address     TEXT,
  time_entry_id  UUID REFERENCES public.job_time_entries(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kiosk_punches_project_idx ON public.kiosk_punches(project_id, punched_at DESC);
CREATE INDEX IF NOT EXISTS kiosk_punches_person_idx  ON public.kiosk_punches(person_id, punched_at DESC);

ALTER TABLE public.kiosk_punches ENABLE ROW LEVEL SECURITY;
-- Admin/owner only — explicit role check, not community_has_permission
-- (project_memberships has no deleted_at — memberships are hard-deleted)
CREATE POLICY kiosk_punches_admin ON public.kiosk_punches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_memberships pm
      WHERE pm.project_id = kiosk_punches.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin', 'owner')
    )
  );

-- 5. Update standalone RLS policy to accept either contractor_id OR person_id
-- (Replaces policy from migration 0158 which only checked contractor_id)
DROP POLICY IF EXISTS job_time_entries_via_contractor ON public.job_time_entries;

CREATE POLICY job_time_entries_via_contractor ON public.job_time_entries
  FOR ALL USING (
    job_id IS NULL AND (
      -- Contractor/employee sees their own entry (via either column)
      EXISTS (
        SELECT 1 FROM public.people p
        WHERE (p.id = job_time_entries.contractor_id OR p.id = job_time_entries.person_id)
          AND p.user_id = auth.uid()
      )
      OR
      -- Staff/admin sees all for their project
      EXISTS (
        SELECT 1 FROM public.people p
        WHERE (p.id = job_time_entries.contractor_id OR p.id = job_time_entries.person_id)
          AND public.community_has_permission(p.project_id, 'jobs', 'view')
      )
    )
  );
