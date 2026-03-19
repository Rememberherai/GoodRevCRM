-- Backfill reply events for inbound emails that share a thread with a sent email.
-- These are real replies (from known org domains) that were never recorded as reply events,
-- causing the dashboard reply rate to show 0%.

INSERT INTO email_events (sent_email_id, event_type, occurred_at, metadata)
SELECT DISTINCT ON (se.id, lower(e.from_email))
  se.id,
  'reply',
  e.email_date,
  jsonb_build_object(
    'from_email', lower(e.from_email),
    'from_name', e.from_name,
    'gmail_message_id', e.gmail_message_id,
    'detection_method', 'backfill'
  )
FROM emails e
JOIN sent_emails se ON se.thread_id = e.gmail_thread_id AND se.project_id = e.project_id
WHERE e.direction = 'inbound'
  AND e.gmail_thread_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM email_events ee
    WHERE ee.sent_email_id = se.id
      AND ee.event_type = 'reply'
      AND ee.metadata->>'from_email' = lower(e.from_email)
  )
ORDER BY se.id, lower(e.from_email), e.email_date ASC;
