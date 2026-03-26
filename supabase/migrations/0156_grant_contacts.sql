-- Grant contacts junction table: many people per grant, each with a role
CREATE TABLE IF NOT EXISTS public.grant_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  role TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (grant_id, person_id)
);

-- Index for fast lookup by grant
CREATE INDEX IF NOT EXISTS grant_contacts_grant_id_idx ON public.grant_contacts(grant_id);

-- RLS: same project-scoped access as grants
ALTER TABLE public.grant_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grant_contacts_project_access" ON public.grant_contacts
  USING (
    EXISTS (
      SELECT 1 FROM public.grants g
      JOIN public.project_memberships pm ON pm.project_id = g.project_id
      WHERE g.id = grant_contacts.grant_id
        AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grants g
      JOIN public.project_memberships pm ON pm.project_id = g.project_id
      WHERE g.id = grant_contacts.grant_id
        AND pm.user_id = auth.uid()
    )
  );
