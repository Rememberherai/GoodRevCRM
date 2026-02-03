-- Content library for reusable RFP answers
CREATE TABLE rfp_content_library (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    question_text TEXT,
    answer_text TEXT NOT NULL,
    answer_html TEXT,
    category TEXT,
    tags TEXT[] DEFAULT '{}',
    source_rfp_id UUID REFERENCES rfps(id) ON DELETE SET NULL,
    source_question_id UUID REFERENCES rfp_questions(id) ON DELETE SET NULL,
    source_document_name TEXT,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Add FK from rfp_questions to content library
ALTER TABLE rfp_questions
ADD COLUMN content_library_source_id UUID REFERENCES rfp_content_library(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_rfp_content_library_project_id ON rfp_content_library(project_id);
CREATE INDEX idx_rfp_content_library_category ON rfp_content_library(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_rfp_content_library_tags ON rfp_content_library USING GIN(tags) WHERE deleted_at IS NULL;
CREATE INDEX idx_rfp_content_library_source_rfp ON rfp_content_library(source_rfp_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_rfp_content_library_created_by ON rfp_content_library(created_by);

-- Full-text search index
CREATE INDEX idx_rfp_content_library_fts ON rfp_content_library
USING GIN(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(question_text, '') || ' ' || COALESCE(answer_text, '')))
WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE rfp_content_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view content library entries in their projects"
ON rfp_content_library FOR SELECT
USING (is_project_member(project_id));

CREATE POLICY "Users can insert content library entries in their projects"
ON rfp_content_library FOR INSERT
WITH CHECK (is_project_member(project_id));

CREATE POLICY "Users can update content library entries in their projects"
ON rfp_content_library FOR UPDATE
USING (is_project_member(project_id));

CREATE POLICY "Admins can delete content library entries"
ON rfp_content_library FOR DELETE
USING (has_project_role(project_id, 'admin'));

-- Updated_at trigger
CREATE TRIGGER set_rfp_content_library_updated_at
    BEFORE UPDATE ON rfp_content_library
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
