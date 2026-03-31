-- Make the unique constraint on (sequence_id, step_number) deferrable
-- so we can shift step numbers atomically without intermediate collisions.
ALTER TABLE sequence_steps
  DROP CONSTRAINT IF EXISTS sequence_steps_sequence_id_step_number_key;

ALTER TABLE sequence_steps
  ADD CONSTRAINT sequence_steps_sequence_id_step_number_key
  UNIQUE (sequence_id, step_number)
  DEFERRABLE INITIALLY IMMEDIATE;

-- Atomically shift sequence step numbers to avoid race conditions
-- when inserting a step at a specific position.
-- Defers the unique constraint check to end-of-statement so
-- intermediate step_number values don't collide.
CREATE OR REPLACE FUNCTION shift_sequence_steps(
  p_sequence_id uuid,
  p_from_step_number int
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  SET CONSTRAINTS sequence_steps_sequence_id_step_number_key DEFERRED;

  UPDATE sequence_steps
  SET step_number = step_number + 1
  WHERE sequence_id = p_sequence_id
    AND step_number >= p_from_step_number;

  SET CONSTRAINTS sequence_steps_sequence_id_step_number_key IMMEDIATE;
END;
$$;
