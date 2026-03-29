-- Add missing resend_domain_id column to email_send_configs
-- Migration 0169 used CREATE TABLE IF NOT EXISTS, so the column was skipped
-- if the table already existed.
ALTER TABLE public.email_send_configs
  ADD COLUMN IF NOT EXISTS resend_domain_id text;
