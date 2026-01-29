-- Migration 003: Project memberships table
-- Manages user access to projects with different roles

CREATE TYPE public.project_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE IF NOT EXISTS public.project_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role public.project_role NOT NULL DEFAULT 'member',
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique membership per project/user
    CONSTRAINT unique_project_membership UNIQUE (project_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.project_memberships ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
CREATE TRIGGER set_project_memberships_updated_at
    BEFORE UPDATE ON public.project_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_memberships_project_id ON public.project_memberships(project_id);
CREATE INDEX IF NOT EXISTS idx_project_memberships_user_id ON public.project_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_project_memberships_role ON public.project_memberships(role);

-- Comments for documentation
COMMENT ON TABLE public.project_memberships IS 'User memberships and roles for projects';
COMMENT ON COLUMN public.project_memberships.role IS 'User role: owner (full control), admin (manage members), member (full CRUD), viewer (read-only)';
