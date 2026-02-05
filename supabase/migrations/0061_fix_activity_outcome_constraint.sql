-- Fix the activity_log outcome CHECK constraint to include all outcome values
-- used by the application (email_received, call_back_later, wrong_number, do_not_call)

-- Drop the old constraint
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_outcome_check;

-- Re-add with all values
ALTER TABLE activity_log ADD CONSTRAINT activity_log_outcome_check
  CHECK (outcome IN (
    'call_no_answer', 'call_left_message', 'call_back_later', 'wrong_number', 'do_not_call',
    'quality_conversation', 'meeting_booked',
    'email_sent', 'email_received', 'email_opened', 'email_replied',
    'proposal_sent', 'follow_up_scheduled', 'not_interested', 'other'
  ));
