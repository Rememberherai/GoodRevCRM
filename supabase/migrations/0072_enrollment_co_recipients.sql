-- Add co_recipient_ids to sequence_enrollments for grouped sends
-- When multiple people from the same org are enrolled together,
-- one becomes the primary (person_id) and the rest go in co_recipient_ids.
-- The processor sends one email with all addresses in the To field.

ALTER TABLE sequence_enrollments
  ADD COLUMN IF NOT EXISTS co_recipient_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN sequence_enrollments.co_recipient_ids IS 'Additional person IDs to include in the To field alongside the primary person_id';
