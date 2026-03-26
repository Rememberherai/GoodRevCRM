-- Add 'grants' as a new project type
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_project_type_check,
  ADD CONSTRAINT projects_project_type_check CHECK (project_type IN ('standard', 'community', 'grants'));

-- Add is_discovered flag to grants table for discovery staging
ALTER TABLE public.grants
  ADD COLUMN IF NOT EXISTS is_discovered BOOLEAN NOT NULL DEFAULT false;

-- Add source_url to grants for tracking where discovered grants came from
ALTER TABLE public.grants
  ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Index for quickly filtering discovered vs pipeline grants
CREATE INDEX IF NOT EXISTS idx_grants_is_discovered ON public.grants (project_id, is_discovered) WHERE is_discovered = true;
