-- Update email performance rates:
-- 1. Use delivered (total_sent - unique_bounces) as denominator for open/click rates
--    Bounced emails can't be opened/clicked, so excluding them gives accurate rates
-- 2. Reply rate and bounce rate still use total_sent as denominator (unchanged)
-- 3. Add delivered count to response

CREATE OR REPLACE FUNCTION get_email_performance(
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
  v_total_sent BIGINT;
  v_total_opens BIGINT;
  v_unique_opens BIGINT;
  v_total_clicks BIGINT;
  v_unique_clicks BIGINT;
  v_total_replies BIGINT;
  v_unique_replies BIGINT;
  v_total_bounces BIGINT;
  v_unique_bounces BIGINT;
  v_delivered BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total_sent
  FROM sent_emails
  WHERE project_id = p_project_id
    AND sent_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR created_by = p_user_id);

  SELECT
    COUNT(*) FILTER (WHERE ee.event_type = 'open'),
    COUNT(DISTINCT CASE WHEN ee.event_type = 'open' THEN se.id END),
    COUNT(*) FILTER (WHERE ee.event_type = 'click'),
    COUNT(DISTINCT CASE WHEN ee.event_type = 'click' THEN se.id END),
    COUNT(*) FILTER (WHERE ee.event_type = 'reply'),
    COUNT(DISTINCT CASE WHEN ee.event_type = 'reply' THEN se.id END),
    COUNT(*) FILTER (WHERE ee.event_type = 'bounce'),
    COUNT(DISTINCT CASE WHEN ee.event_type = 'bounce' THEN se.id END)
  INTO v_total_opens, v_unique_opens, v_total_clicks, v_unique_clicks, v_total_replies, v_unique_replies, v_total_bounces, v_unique_bounces
  FROM sent_emails se
  JOIN email_events ee ON se.id = ee.sent_email_id
  WHERE se.project_id = p_project_id
    AND se.sent_at BETWEEN p_start_date AND p_end_date
    AND (p_user_id IS NULL OR se.created_by = p_user_id);

  -- Delivered = sent minus bounced
  v_delivered := v_total_sent - COALESCE(v_unique_bounces, 0);

  RETURN json_build_object(
    'total_sent', v_total_sent,
    'delivered', v_delivered,
    'total_opens', COALESCE(v_total_opens, 0),
    'unique_opens', COALESCE(v_unique_opens, 0),
    'total_clicks', COALESCE(v_total_clicks, 0),
    'unique_clicks', COALESCE(v_unique_clicks, 0),
    'total_replies', COALESCE(v_total_replies, 0),
    'unique_replies', COALESCE(v_unique_replies, 0),
    'total_bounces', COALESCE(v_total_bounces, 0),
    'unique_bounces', COALESCE(v_unique_bounces, 0),
    'open_rate', CASE WHEN v_delivered > 0
      THEN ROUND(COALESCE(v_unique_opens, 0)::NUMERIC / v_delivered * 100, 1)
      ELSE 0
    END,
    'click_rate', CASE WHEN v_delivered > 0
      THEN ROUND(COALESCE(v_unique_clicks, 0)::NUMERIC / v_delivered * 100, 1)
      ELSE 0
    END,
    'reply_rate', CASE WHEN v_total_sent > 0
      THEN ROUND(COALESCE(v_unique_replies, 0)::NUMERIC / v_total_sent * 100, 1)
      ELSE 0
    END,
    'bounce_rate', CASE WHEN v_total_sent > 0
      THEN ROUND(COALESCE(v_unique_bounces, 0)::NUMERIC / v_total_sent * 100, 1)
      ELSE 0
    END
  );
END;
$$;
