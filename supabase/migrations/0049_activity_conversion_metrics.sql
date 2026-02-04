-- ============================================================================
-- Activity Conversion Metrics RPC
-- Returns micro conversion funnel counts for sales activity analysis
-- ============================================================================

CREATE OR REPLACE FUNCTION get_activity_conversion_metrics(
  p_project_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Call funnel
  v_calls_made BIGINT := 0;
  v_call_no_answer BIGINT := 0;
  v_call_left_message BIGINT := 0;
  v_call_connects BIGINT := 0;
  v_call_meetings_booked BIGINT := 0;
  -- Email funnel
  v_emails_sent BIGINT := 0;
  v_emails_opened BIGINT := 0;
  v_emails_clicked BIGINT := 0;
  v_emails_replied BIGINT := 0;
  -- Meeting funnel
  v_meetings_booked BIGINT := 0;
  v_meetings_attended BIGINT := 0;
  v_meetings_no_show BIGINT := 0;
  v_meetings_cancelled BIGINT := 0;
  v_meetings_positive_outcome BIGINT := 0;
  v_meetings_deal_advanced BIGINT := 0;
  -- Pipeline
  v_proposals_sent BIGINT := 0;
  v_opportunities_created BIGINT := 0;
  v_not_interested BIGINT := 0;
BEGIN
  -- ============================
  -- CALL FUNNEL (from activity_log)
  -- ============================
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE outcome = 'call_no_answer'),
    COUNT(*) FILTER (WHERE outcome = 'call_left_message'),
    COUNT(*) FILTER (WHERE outcome = 'quality_conversation'),
    COUNT(*) FILTER (WHERE outcome = 'meeting_booked')
  INTO v_calls_made, v_call_no_answer, v_call_left_message, v_call_connects, v_call_meetings_booked
  FROM activity_log
  WHERE project_id = p_project_id
    AND activity_type = 'call'
    AND created_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR user_id = p_user_id);

  -- ============================
  -- EMAIL FUNNEL
  -- ============================
  -- Emails sent
  SELECT COUNT(*) INTO v_emails_sent
  FROM sent_emails
  WHERE project_id = p_project_id
    AND sent_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR created_by = p_user_id);

  -- Email events (unique per email, joined through sent_emails for project scoping)
  SELECT
    COUNT(DISTINCT CASE WHEN ee.event_type = 'open' THEN ee.sent_email_id END),
    COUNT(DISTINCT CASE WHEN ee.event_type = 'click' THEN ee.sent_email_id END),
    COUNT(DISTINCT CASE WHEN ee.event_type = 'reply' THEN ee.sent_email_id END)
  INTO v_emails_opened, v_emails_clicked, v_emails_replied
  FROM email_events ee
  JOIN sent_emails se ON se.id = ee.sent_email_id
  WHERE se.project_id = p_project_id
    AND se.sent_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR se.created_by = p_user_id);

  -- ============================
  -- MEETING FUNNEL
  -- ============================
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'attended'),
    COUNT(*) FILTER (WHERE status = 'no_show'),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*) FILTER (WHERE outcome IN ('positive', 'deal_advanced')),
    COUNT(*) FILTER (WHERE outcome = 'deal_advanced')
  INTO v_meetings_booked, v_meetings_attended, v_meetings_no_show,
       v_meetings_cancelled, v_meetings_positive_outcome, v_meetings_deal_advanced
  FROM meetings
  WHERE project_id = p_project_id
    AND created_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR created_by = p_user_id);

  -- ============================
  -- PIPELINE METRICS
  -- ============================
  -- Proposals sent (from activity_log)
  SELECT COUNT(*) INTO v_proposals_sent
  FROM activity_log
  WHERE project_id = p_project_id
    AND outcome = 'proposal_sent'
    AND created_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR user_id = p_user_id);

  -- Opportunities created in period
  SELECT COUNT(*) INTO v_opportunities_created
  FROM opportunities
  WHERE project_id = p_project_id
    AND deleted_at IS NULL
    AND created_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR owner_id = p_user_id);

  -- Not interested outcomes
  SELECT COUNT(*) INTO v_not_interested
  FROM activity_log
  WHERE project_id = p_project_id
    AND outcome = 'not_interested'
    AND created_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR user_id = p_user_id);

  RETURN json_build_object(
    'calls_made', v_calls_made,
    'call_no_answer', v_call_no_answer,
    'call_left_message', v_call_left_message,
    'call_connects', v_call_connects,
    'call_meetings_booked', v_call_meetings_booked,
    'emails_sent', v_emails_sent,
    'emails_opened', v_emails_opened,
    'emails_clicked', v_emails_clicked,
    'emails_replied', v_emails_replied,
    'meetings_booked', v_meetings_booked,
    'meetings_attended', v_meetings_attended,
    'meetings_no_show', v_meetings_no_show,
    'meetings_cancelled', v_meetings_cancelled,
    'meetings_positive_outcome', v_meetings_positive_outcome,
    'meetings_deal_advanced', v_meetings_deal_advanced,
    'proposals_sent', v_proposals_sent,
    'opportunities_created', v_opportunities_created,
    'not_interested', v_not_interested
  );
END;
$$;
