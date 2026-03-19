-- Backfill bounce events for sent_emails that have a matching inbound bounce
-- notification email but no bounce event recorded.
-- This catches bounces that were detected during sync but dropped because
-- the person had no active sequence enrollment.

INSERT INTO email_events (sent_email_id, event_type, occurred_at, metadata)
SELECT DISTINCT ON (se.id)
  se.id,
  'bounce',
  e.email_date,
  jsonb_build_object(
    'bounced_email', se.recipient_email,
    'detection_method', 'backfill',
    'bounce_subject', e.subject
  )
FROM sent_emails se
-- Find bounce notification emails in the same thread
JOIN emails e ON e.gmail_thread_id = se.thread_id
  AND e.project_id = se.project_id
  AND e.direction = 'inbound'
  AND (
    lower(e.from_email) LIKE 'mailer-daemon@%'
    OR lower(e.from_email) LIKE 'postmaster@%'
    OR lower(e.from_email) LIKE 'mail-daemon@%'
    OR lower(e.from_email) = 'noreply-dmarc@google.com'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM email_events ee
  WHERE ee.sent_email_id = se.id
    AND ee.event_type = 'bounce'
)
ORDER BY se.id, e.email_date ASC;
