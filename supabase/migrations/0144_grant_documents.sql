-- Migration 0144: Grant documents table + storage bucket
-- Allows attaching files (narratives, budgets, support letters, etc.) to grants

CREATE TABLE IF NOT EXISTS public.grant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'narrative', 'budget', 'support_letter', 'irs_determination',
    'board_list', 'financial_audit', 'logic_model', 'timeline',
    'mou', 'funder_agreement', 'report', 'amendment', 'other'
  )),
  label TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_submitted BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.grant_documents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_grant_documents_updated_at
  BEFORE UPDATE ON public.grant_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_grant_documents_grant
  ON public.grant_documents(grant_id);

CREATE INDEX IF NOT EXISTS idx_grant_documents_project
  ON public.grant_documents(project_id);

-- RLS policies: same pattern as grants table
DROP POLICY IF EXISTS grant_documents_select ON public.grant_documents;
CREATE POLICY grant_documents_select ON public.grant_documents
  FOR SELECT
  USING (public.community_has_permission(project_id, 'grants', 'view'));

DROP POLICY IF EXISTS grant_documents_insert ON public.grant_documents;
CREATE POLICY grant_documents_insert ON public.grant_documents
  FOR INSERT
  WITH CHECK (public.community_has_permission(project_id, 'grants', 'create'));

DROP POLICY IF EXISTS grant_documents_update ON public.grant_documents;
CREATE POLICY grant_documents_update ON public.grant_documents
  FOR UPDATE
  USING (public.community_has_permission(project_id, 'grants', 'update'))
  WITH CHECK (public.community_has_permission(project_id, 'grants', 'update'));

DROP POLICY IF EXISTS grant_documents_delete ON public.grant_documents;
CREATE POLICY grant_documents_delete ON public.grant_documents
  FOR DELETE
  USING (public.community_has_permission(project_id, 'grants', 'delete'));

-- Storage bucket for grant documents (private, authenticated access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('grant-documents', 'grant-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: broad authenticated access (project scoping enforced in API)
CREATE POLICY "Authenticated users can upload grant documents"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'grant-documents');

CREATE POLICY "Authenticated users can read grant documents"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'grant-documents');

CREATE POLICY "Authenticated users can delete grant documents"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'grant-documents');
