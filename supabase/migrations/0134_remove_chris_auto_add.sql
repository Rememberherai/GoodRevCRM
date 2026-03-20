-- Remove the trigger that auto-adds Chris to every new project.
-- Existing memberships are NOT deleted — only the auto-add behavior is removed.

DROP TRIGGER IF EXISTS on_project_created_add_chris ON public.projects;
DROP FUNCTION IF EXISTS public.handle_new_project_add_chris();
