-- Migration 0184: Browser scheduler history table
-- Stores execution history for browser-based cron job execution.
-- The browser scheduler runs setInterval in the user's browser tab,
-- hitting cron endpoints via session cookie auth.

CREATE TABLE IF NOT EXISTS public.browser_scheduler_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    template_key TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INTEGER,
    http_status INTEGER,
    status TEXT NOT NULL DEFAULT 'running',  -- running | success | error
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bsh_project_template
    ON public.browser_scheduler_history(project_id, template_key, started_at DESC);

ALTER TABLE public.browser_scheduler_history ENABLE ROW LEVEL SECURITY;

-- Only project admins/owners can view history
CREATE POLICY "browser_scheduler_history_select" ON public.browser_scheduler_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = browser_scheduler_history.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('admin', 'owner')
        )
    );

-- Only project admins/owners can insert history
CREATE POLICY "browser_scheduler_history_insert" ON public.browser_scheduler_history
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = browser_scheduler_history.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('admin', 'owner')
        )
    );

-- Only project admins/owners can delete history (for pruning)
CREATE POLICY "browser_scheduler_history_delete" ON public.browser_scheduler_history
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = browser_scheduler_history.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('admin', 'owner')
        )
    );

COMMENT ON TABLE public.browser_scheduler_history IS 'Execution history for browser-based cron scheduler';
COMMENT ON COLUMN public.browser_scheduler_history.template_key IS 'Cron template key, e.g. process-sequences';
COMMENT ON COLUMN public.browser_scheduler_history.status IS 'Execution status: running, success, or error';
