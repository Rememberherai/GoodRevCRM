-- Migration 0052: Add Chris to all projects as a member
-- Also add a trigger so Chris is auto-added to every new project

-- Chris's user_id
DO $$
DECLARE
  chris_id UUID := 'e8675032-3664-4c44-8752-8cf38256c1f6';
  proj RECORD;
BEGIN
  -- Add Chris to all existing projects where he is not already a member
  FOR proj IN SELECT id FROM projects WHERE deleted_at IS NULL
  LOOP
    INSERT INTO project_memberships (project_id, user_id, role)
    VALUES (proj.id, chris_id, 'member')
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END LOOP;
END $$;

-- Trigger function: auto-add Chris to every new project
CREATE OR REPLACE FUNCTION public.handle_new_project_add_chris()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.project_memberships (project_id, user_id, role)
  VALUES (NEW.id, 'e8675032-3664-4c44-8752-8cf38256c1f6', 'member')
  ON CONFLICT (project_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_project_created_add_chris
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_project_add_chris();
