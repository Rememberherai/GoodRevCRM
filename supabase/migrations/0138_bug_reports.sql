-- Bug reports table for in-app bug reporting
CREATE TABLE IF NOT EXISTS public.bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    page_url TEXT NOT NULL,
    screenshot_path TEXT,
    status TEXT NOT NULL DEFAULT 'open'
      CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    resolution_notes TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own bug reports
CREATE POLICY bug_reports_insert_own ON public.bug_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own bug reports
CREATE POLICY bug_reports_select_own ON public.bug_reports
    FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON public.bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports(status);

CREATE TRIGGER set_bug_reports_updated_at
    BEFORE UPDATE ON public.bug_reports
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
