-- Migration 002: Projects table
-- Core multi-tenancy table for organizing CRM data by project

CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
CREATE TRIGGER set_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON public.projects(deleted_at) WHERE deleted_at IS NULL;

-- Comments for documentation
COMMENT ON TABLE public.projects IS 'Multi-tenant projects for organizing CRM data';
COMMENT ON COLUMN public.projects.slug IS 'URL-friendly unique identifier for the project';
COMMENT ON COLUMN public.projects.settings IS 'Project-specific settings stored as JSONB';
COMMENT ON COLUMN public.projects.deleted_at IS 'Soft delete timestamp';
