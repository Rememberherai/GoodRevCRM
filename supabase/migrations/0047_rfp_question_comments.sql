-- Migration 0044: RFP Question Comments
-- Threaded comments on individual RFP questions for team collaboration

CREATE TABLE IF NOT EXISTS public.rfp_question_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.rfp_questions(id) ON DELETE CASCADE,
    rfp_id UUID NOT NULL REFERENCES public.rfps(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.rfp_question_comments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_rfp_question_comments_updated_at
    BEFORE UPDATE ON public.rfp_question_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_rfp_question_comments_question ON public.rfp_question_comments(question_id);
CREATE INDEX idx_rfp_question_comments_rfp ON public.rfp_question_comments(rfp_id);
CREATE INDEX idx_rfp_question_comments_project ON public.rfp_question_comments(project_id);
CREATE INDEX idx_rfp_question_comments_created_by ON public.rfp_question_comments(created_by);
CREATE INDEX idx_rfp_question_comments_active ON public.rfp_question_comments(question_id, created_at) WHERE deleted_at IS NULL;

-- RLS Policies
CREATE POLICY "Members can view project rfp_question_comments"
    ON public.rfp_question_comments
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.is_project_member(project_id)
    );

CREATE POLICY "Members can create rfp_question_comments"
    ON public.rfp_question_comments
    FOR INSERT
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

CREATE POLICY "Members can update own rfp_question_comments"
    ON public.rfp_question_comments
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND created_by = auth.uid()
        AND public.has_project_role(project_id, 'member')
    )
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

CREATE POLICY "Members can delete own rfp_question_comments"
    ON public.rfp_question_comments
    FOR DELETE
    USING (
        created_by = auth.uid()
        AND public.has_project_role(project_id, 'member')
    );
