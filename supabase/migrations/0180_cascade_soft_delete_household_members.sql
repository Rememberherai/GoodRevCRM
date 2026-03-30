-- When a person is soft-deleted, remove their household memberships
-- so stale/unresolvable references don't appear in the UI.

CREATE OR REPLACE FUNCTION public.cascade_person_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.household_members
    WHERE person_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_person_soft_delete ON public.people;
CREATE TRIGGER trg_cascade_person_soft_delete
  AFTER UPDATE OF deleted_at ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_person_soft_delete();

-- Clean up any existing orphaned memberships (person already soft-deleted)
DELETE FROM public.household_members
WHERE person_id IN (
  SELECT id FROM public.people WHERE deleted_at IS NOT NULL
);
