-- Migration: pg_cron scheduler helper functions
-- These SECURITY DEFINER functions expose pg_cron management through PostgREST RPC.
-- They use pg_net for HTTP callbacks so cron jobs can call the app's API endpoints.

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- List jobs matching a name prefix (e.g., 'goodrev_abc12345_')
CREATE OR REPLACE FUNCTION scheduler_list_jobs(p_prefix TEXT)
RETURNS TABLE(
  job_id BIGINT,
  job_name TEXT,
  schedule TEXT,
  command TEXT,
  active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  RETURN QUERY
    SELECT j.jobid, j.jobname, j.schedule, j.command, j.active
    FROM cron.job j
    WHERE j.jobname LIKE p_prefix || '%';
END;
$$;

-- Create a cron job that makes an HTTP POST via pg_net
CREATE OR REPLACE FUNCTION scheduler_create_job(
  p_name TEXT,
  p_schedule TEXT,
  p_url TEXT,
  p_headers JSONB DEFAULT '{}'::JSONB,
  p_body JSONB DEFAULT '{}'::JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
DECLARE
  v_job_id BIGINT;
  v_command TEXT;
BEGIN
  v_command := format(
    'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
    p_url, p_headers::text, p_body::text
  );
  SELECT cron.schedule(p_name, p_schedule, v_command) INTO v_job_id;
  RETURN v_job_id;
END;
$$;

-- Update a job's schedule and/or active state
CREATE OR REPLACE FUNCTION scheduler_update_job(
  p_name TEXT,
  p_schedule TEXT DEFAULT NULL,
  p_active BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = p_name;
  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Job not found: %', p_name;
  END IF;

  IF p_schedule IS NOT NULL AND p_active IS NOT NULL THEN
    PERFORM cron.alter_job(v_job_id, schedule := p_schedule, active := p_active);
  ELSIF p_schedule IS NOT NULL THEN
    PERFORM cron.alter_job(v_job_id, schedule := p_schedule);
  ELSIF p_active IS NOT NULL THEN
    PERFORM cron.alter_job(v_job_id, active := p_active);
  END IF;
END;
$$;

-- Delete a job by name
CREATE OR REPLACE FUNCTION scheduler_delete_job(p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  PERFORM cron.unschedule(p_name);
END;
$$;

-- Get execution history for a job
CREATE OR REPLACE FUNCTION scheduler_job_history(p_name TEXT, p_limit INT DEFAULT 10)
RETURNS TABLE(
  run_id BIGINT,
  job_id BIGINT,
  status TEXT,
  return_message TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = p_name;
  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT d.runid, d.jobid, d.status, d.return_message, d.start_time, d.end_time
    FROM cron.job_run_details d
    WHERE d.jobid = v_job_id
    ORDER BY d.start_time DESC
    LIMIT p_limit;
END;
$$;
