-- ============================================================================
-- 0179_case_management_incidents.sql
-- Community case management + incident logging
-- ============================================================================

-- 1. Extend community permissions
CREATE OR REPLACE FUNCTION public.community_has_permission(
  p_project_id UUID,
  p_resource TEXT,
  p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.project_role;
BEGIN
  v_role := public.community_current_role(p_project_id);

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role IN ('owner', 'admin') THEN
    RETURN (
      (p_resource IN ('households', 'intake', 'programs', 'contributions', 'community_assets', 'referrals', 'relationships', 'broadcasts', 'grants', 'jobs', 'assistant_ap', 'cases', 'incidents')
        AND p_action IN ('view', 'create', 'update', 'delete'))
      OR (p_resource = 'events' AND p_action IN ('view', 'create', 'update', 'delete', 'export_pii', 'manage'))
      OR (p_resource = 'risk_scores' AND p_action IN ('view', 'update'))
      OR (p_resource = 'dashboard' AND p_action = 'view')
      OR (p_resource = 'reports' AND p_action IN ('view', 'export_pii'))
      OR (p_resource = 'settings' AND p_action IN ('view', 'update'))
      OR (p_resource = 'public_dashboard' AND p_action = 'manage')
      OR (p_resource = 'asset_access' AND p_action IN ('view', 'manage'))
      OR (p_resource = 'workflows' AND p_action IN ('view', 'create', 'update', 'delete', 'manage'))
    );
  END IF;

  IF v_role = 'staff' THEN
    RETURN (
      (p_resource IN ('households', 'programs', 'contributions', 'community_assets', 'referrals', 'relationships', 'broadcasts')
        AND p_action IN ('view', 'create', 'update', 'delete'))
      OR (p_resource = 'incidents' AND p_action IN ('view', 'create', 'update'))
      OR (p_resource = 'events' AND p_action IN ('view', 'create', 'update'))
      OR (p_resource = 'grants' AND p_action = 'view')
      OR (p_resource = 'jobs' AND p_action IN ('view', 'create', 'update', 'delete'))
      OR (p_resource = 'assistant_ap' AND p_action IN ('view', 'create', 'update'))
      OR (p_resource IN ('dashboard', 'reports', 'settings') AND p_action = 'view')
      OR (p_resource = 'risk_scores' AND p_action = 'view')
      OR (p_resource = 'asset_access' AND p_action IN ('view', 'manage'))
      OR (p_resource = 'workflows' AND p_action IN ('view', 'create', 'update'))
    );
  END IF;

  IF v_role = 'case_manager' THEN
    RETURN (
      (p_resource IN ('households', 'intake', 'programs', 'contributions', 'community_assets', 'referrals', 'relationships', 'broadcasts', 'cases', 'incidents')
        AND p_action IN ('view', 'create', 'update', 'delete'))
      OR (p_resource = 'events' AND p_action IN ('view', 'create', 'update'))
      OR (p_resource = 'grants' AND p_action = 'view')
      OR (p_resource = 'jobs' AND p_action = 'view')
      OR (p_resource = 'assistant_ap' AND p_action IN ('view', 'create', 'update'))
      OR (p_resource = 'dashboard' AND p_action = 'view')
      OR (p_resource = 'reports' AND p_action = 'view')
      OR (p_resource = 'settings' AND p_action = 'view')
      OR (p_resource = 'risk_scores' AND p_action IN ('view', 'update'))
      OR (p_resource = 'asset_access' AND p_action = 'view')
      OR (p_resource = 'workflows' AND p_action = 'view')
    );
  END IF;

  IF v_role = 'contractor' THEN
    RETURN (
      (p_resource = 'jobs' AND p_action IN ('view', 'update'))
      OR (p_resource = 'settings' AND p_action = 'view')
    );
  END IF;

  IF v_role = 'board_viewer' THEN
    RETURN (
      (p_resource = 'grants' AND p_action = 'view')
      OR (p_resource = 'dashboard' AND p_action = 'view')
      OR (p_resource = 'reports' AND p_action = 'view')
    );
  END IF;

  IF v_role = 'member' THEN
    RETURN (
      (p_resource = 'grants' AND p_action IN ('view', 'create', 'update'))
      OR (p_resource = 'dashboard' AND p_action = 'view')
      OR (p_resource = 'reports' AND p_action = 'view')
      OR (p_resource = 'settings' AND p_action = 'view')
    );
  END IF;

  IF v_role = 'viewer' THEN
    RETURN (
      (p_resource = 'grants' AND p_action = 'view')
      OR (p_resource = 'dashboard' AND p_action = 'view')
      OR (p_resource = 'reports' AND p_action = 'view')
      OR (p_resource = 'settings' AND p_action = 'view')
    );
  END IF;

  RETURN FALSE;
END;
$$;

-- 3. Tables
CREATE TABLE IF NOT EXISTS public.household_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'active', 'on_hold', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  closed_reason TEXT,
  last_contact_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  summary TEXT,
  barriers TEXT,
  strengths TEXT,
  consent_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_household_cases_one_active
  ON public.household_cases(household_id)
  WHERE status <> 'closed';
CREATE INDEX IF NOT EXISTS idx_household_cases_project ON public.household_cases(project_id);
CREATE INDEX IF NOT EXISTS idx_household_cases_household ON public.household_cases(household_id);
CREATE INDEX IF NOT EXISTS idx_household_cases_assigned_to ON public.household_cases(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_household_cases_follow_up ON public.household_cases(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.household_case_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.household_cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  target_date DATE,
  completed_at TIMESTAMPTZ,
  owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  dimension_id UUID REFERENCES public.impact_dimensions(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_household_case_goals_case ON public.household_case_goals(case_id);
CREATE INDEX IF NOT EXISTS idx_household_case_goals_status ON public.household_case_goals(status);

CREATE TABLE IF NOT EXISTS public.household_case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.household_cases(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('opened', 'assigned', 'status_changed', 'follow_up_scheduled', 'contact_logged', 'goal_completed', 'closed', 'reopened')),
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_household_case_events_case ON public.household_case_events(case_id);
CREATE INDEX IF NOT EXISTS idx_household_case_events_household ON public.household_case_events(household_id);
CREATE INDEX IF NOT EXISTS idx_household_case_events_project_created ON public.household_case_events(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reported_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('behavior', 'facility', 'injury', 'safety', 'conflict', 'theft', 'medical', 'other')),
  visibility TEXT NOT NULL DEFAULT 'operations'
    CHECK (visibility IN ('private', 'case_management', 'operations')),
  summary TEXT NOT NULL,
  details TEXT,
  resolution_notes TEXT,
  follow_up_due_at TIMESTAMPTZ,
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.community_assets(id) ON DELETE SET NULL,
  location_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_project ON public.incidents(project_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_follow_up ON public.incidents(follow_up_due_at) WHERE follow_up_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_household ON public.incidents(household_id) WHERE household_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_event ON public.incidents(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_asset ON public.incidents(asset_id) WHERE asset_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.incident_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'other'
    CHECK (role IN ('subject', 'reporter', 'witness', 'guardian_notified', 'staff_present', 'victim', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT incident_people_unique UNIQUE (incident_id, person_id, role)
);

CREATE INDEX IF NOT EXISTS idx_incident_people_incident ON public.incident_people(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_people_person ON public.incident_people(person_id);

-- 4. Helper access functions
CREATE OR REPLACE FUNCTION public.community_can_access_case(
  p_case_id UUID,
  p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT public.community_has_permission(c.project_id, 'cases', p_action)
      FROM public.household_cases c
      WHERE c.id = p_case_id
    ),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.community_can_access_incident(
  p_incident_id UUID,
  p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN i.visibility = 'operations' THEN public.community_has_permission(i.project_id, 'incidents', p_action)
        ELSE public.community_has_permission(i.project_id, 'cases', p_action)
      END
      FROM public.incidents i
      WHERE i.id = p_incident_id
    ),
    FALSE
  );
$$;

-- 5. Extend tasks + notes
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.household_cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS incident_id UUID REFERENCES public.incidents(id) ON DELETE SET NULL,
  DROP CONSTRAINT IF EXISTS tasks_case_incident_exclusive,
  ADD CONSTRAINT tasks_case_incident_exclusive CHECK (NOT (case_id IS NOT NULL AND incident_id IS NOT NULL));

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES public.household_cases(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS category TEXT,
  DROP CONSTRAINT IF EXISTS notes_case_incident_exclusive,
  ADD CONSTRAINT notes_case_incident_exclusive CHECK (NOT (case_id IS NOT NULL AND incident_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_tasks_household ON public.tasks(household_id) WHERE household_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_case ON public.tasks(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_incident ON public.tasks(incident_id) WHERE incident_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_household ON public.notes(household_id) WHERE household_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_case ON public.notes(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_incident ON public.notes(incident_id) WHERE incident_id IS NOT NULL;

-- 6. RLS
ALTER TABLE public.household_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_case_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_household_cases ON public.household_cases FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_household_case_goals ON public.household_case_goals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_household_case_events ON public.household_case_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_incidents ON public.incidents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_incident_people ON public.incident_people FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY household_cases_select ON public.household_cases
  FOR SELECT USING (public.community_has_permission(project_id, 'cases', 'view'));
CREATE POLICY household_cases_insert ON public.household_cases
  FOR INSERT WITH CHECK (public.community_has_permission(project_id, 'cases', 'create'));
CREATE POLICY household_cases_update ON public.household_cases
  FOR UPDATE USING (public.community_has_permission(project_id, 'cases', 'update'))
  WITH CHECK (public.community_has_permission(project_id, 'cases', 'update'));
CREATE POLICY household_cases_delete ON public.household_cases
  FOR DELETE USING (public.community_has_permission(project_id, 'cases', 'delete'));

CREATE POLICY household_case_goals_select ON public.household_case_goals
  FOR SELECT USING (public.community_can_access_case(case_id, 'view'));
CREATE POLICY household_case_goals_insert ON public.household_case_goals
  FOR INSERT WITH CHECK (public.community_can_access_case(case_id, 'create'));
CREATE POLICY household_case_goals_update ON public.household_case_goals
  FOR UPDATE USING (public.community_can_access_case(case_id, 'update'))
  WITH CHECK (public.community_can_access_case(case_id, 'update'));
CREATE POLICY household_case_goals_delete ON public.household_case_goals
  FOR DELETE USING (public.community_can_access_case(case_id, 'delete'));

CREATE POLICY household_case_events_select ON public.household_case_events
  FOR SELECT USING (public.community_can_access_case(case_id, 'view'));
CREATE POLICY household_case_events_insert ON public.household_case_events
  FOR INSERT WITH CHECK (public.community_can_access_case(case_id, 'update'));

CREATE POLICY incidents_select ON public.incidents
  FOR SELECT USING (public.community_can_access_incident(id, 'view'));
CREATE POLICY incidents_insert ON public.incidents
  FOR INSERT WITH CHECK (
    CASE
      WHEN visibility = 'operations' THEN public.community_has_permission(project_id, 'incidents', 'create')
      ELSE public.community_has_permission(project_id, 'cases', 'create')
    END
  );
CREATE POLICY incidents_update ON public.incidents
  FOR UPDATE USING (public.community_can_access_incident(id, 'update'))
  WITH CHECK (
    CASE
      WHEN visibility = 'operations' THEN public.community_has_permission(project_id, 'incidents', 'update')
      ELSE public.community_has_permission(project_id, 'cases', 'update')
    END
  );
CREATE POLICY incidents_delete ON public.incidents
  FOR DELETE USING (public.community_can_access_incident(id, 'delete'));

CREATE POLICY incident_people_select ON public.incident_people
  FOR SELECT USING (public.community_can_access_incident(incident_id, 'view'));
CREATE POLICY incident_people_insert ON public.incident_people
  FOR INSERT WITH CHECK (public.community_can_access_incident(incident_id, 'create'));
CREATE POLICY incident_people_update ON public.incident_people
  FOR UPDATE USING (public.community_can_access_incident(incident_id, 'update'))
  WITH CHECK (public.community_can_access_incident(incident_id, 'update'));
CREATE POLICY incident_people_delete ON public.incident_people
  FOR DELETE USING (public.community_can_access_incident(incident_id, 'delete'));

-- 6. Replace tasks + notes RLS
DROP POLICY IF EXISTS "Users can view tasks in their projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks in their projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks in their projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks or as admin" ON public.tasks;

CREATE POLICY tasks_select_sensitive ON public.tasks
  FOR SELECT USING (
    (
      case_id IS NULL
      AND incident_id IS NULL
      AND project_id IN (SELECT project_id FROM public.project_memberships WHERE user_id = auth.uid())
    )
    OR (
      case_id IS NOT NULL
      AND public.community_can_access_case(case_id, 'view')
    )
    OR (
      incident_id IS NOT NULL
      AND public.community_can_access_incident(incident_id, 'view')
    )
  );

CREATE POLICY tasks_insert_sensitive ON public.tasks
  FOR INSERT WITH CHECK (
    (
      case_id IS NULL
      AND incident_id IS NULL
      AND project_id IN (SELECT project_id FROM public.project_memberships WHERE user_id = auth.uid())
    )
    OR (
      case_id IS NOT NULL
      AND public.community_can_access_case(case_id, 'create')
    )
    OR (
      incident_id IS NOT NULL
      AND public.community_can_access_incident(incident_id, 'create')
    )
  );

CREATE POLICY tasks_update_sensitive ON public.tasks
  FOR UPDATE USING (
    (
      case_id IS NULL
      AND incident_id IS NULL
      AND project_id IN (SELECT project_id FROM public.project_memberships WHERE user_id = auth.uid())
    )
    OR (
      case_id IS NOT NULL
      AND public.community_can_access_case(case_id, 'update')
    )
    OR (
      incident_id IS NOT NULL
      AND public.community_can_access_incident(incident_id, 'update')
    )
  )
  WITH CHECK (
    (
      case_id IS NULL
      AND incident_id IS NULL
      AND project_id IN (SELECT project_id FROM public.project_memberships WHERE user_id = auth.uid())
    )
    OR (
      case_id IS NOT NULL
      AND public.community_can_access_case(case_id, 'update')
    )
    OR (
      incident_id IS NOT NULL
      AND public.community_can_access_incident(incident_id, 'update')
    )
  );

CREATE POLICY tasks_delete_sensitive ON public.tasks
  FOR DELETE USING (
    (
      case_id IS NULL
      AND incident_id IS NULL
      AND (
        created_by = auth.uid()
        OR project_id IN (
          SELECT project_id
          FROM public.project_memberships
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
      )
    )
    OR (
      case_id IS NOT NULL
      AND public.community_can_access_case(case_id, 'delete')
    )
    OR (
      incident_id IS NOT NULL
      AND public.community_can_access_incident(incident_id, 'delete')
    )
  );

DROP POLICY IF EXISTS "Users can view notes in their projects" ON public.notes;
DROP POLICY IF EXISTS "Users can create notes in their projects" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes or as admin" ON public.notes;

CREATE POLICY notes_select_sensitive ON public.notes
  FOR SELECT USING (
    (
      case_id IS NULL
      AND incident_id IS NULL
      AND project_id IN (SELECT project_id FROM public.project_memberships WHERE user_id = auth.uid())
    )
    OR (
      case_id IS NOT NULL
      AND public.community_can_access_case(case_id, 'view')
    )
    OR (
      incident_id IS NOT NULL
      AND public.community_can_access_incident(incident_id, 'view')
    )
  );

CREATE POLICY notes_insert_sensitive ON public.notes
  FOR INSERT WITH CHECK (
    (
      case_id IS NULL
      AND incident_id IS NULL
      AND project_id IN (SELECT project_id FROM public.project_memberships WHERE user_id = auth.uid())
    )
    OR (
      case_id IS NOT NULL
      AND public.community_can_access_case(case_id, 'create')
    )
    OR (
      incident_id IS NOT NULL
      AND public.community_can_access_incident(incident_id, 'create')
    )
  );

CREATE POLICY notes_update_sensitive ON public.notes
  FOR UPDATE USING (
    (
      case_id IS NULL
      AND incident_id IS NULL
      AND created_by = auth.uid()
    )
    OR (
      case_id IS NOT NULL
      AND public.community_can_access_case(case_id, 'update')
    )
    OR (
      incident_id IS NOT NULL
      AND public.community_can_access_incident(incident_id, 'update')
    )
  )
  WITH CHECK (
    (
      case_id IS NULL
      AND incident_id IS NULL
      AND created_by = auth.uid()
    )
    OR (
      case_id IS NOT NULL
      AND public.community_can_access_case(case_id, 'update')
    )
    OR (
      incident_id IS NOT NULL
      AND public.community_can_access_incident(incident_id, 'update')
    )
  );

CREATE POLICY notes_delete_sensitive ON public.notes
  FOR DELETE USING (
    (
      case_id IS NULL
      AND incident_id IS NULL
      AND (
        created_by = auth.uid()
        OR project_id IN (
          SELECT project_id
          FROM public.project_memberships
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
      )
    )
    OR (
      case_id IS NOT NULL
      AND public.community_can_access_case(case_id, 'delete')
    )
    OR (
      incident_id IS NOT NULL
      AND public.community_can_access_incident(incident_id, 'delete')
    )
  );

-- 7. Triggers for updated_at
CREATE TRIGGER set_household_cases_updated_at
  BEFORE UPDATE ON public.household_cases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_household_case_goals_updated_at
  BEFORE UPDATE ON public.household_case_goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_incidents_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
