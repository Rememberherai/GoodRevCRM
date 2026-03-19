-- Backfill organization_id on outbound emails where it's null but the
-- person is linked to an organization via person_organizations.
-- This fixes outbound emails not appearing on org detail pages.

UPDATE emails e
SET organization_id = po.organization_id
FROM person_organizations po
WHERE e.person_id = po.person_id
  AND e.organization_id IS NULL
  AND e.direction = 'outbound'
  AND po.is_current = true;
