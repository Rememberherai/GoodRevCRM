-- Add blocks_outreach flag to dispositions
-- When true, outreach actions (sequence enrollment, email sends) show a warning dialog

ALTER TABLE public.dispositions
  ADD COLUMN IF NOT EXISTS blocks_outreach BOOLEAN NOT NULL DEFAULT false;

-- Set blocks_outreach=true for any existing "Not a Fit" dispositions
UPDATE public.dispositions SET blocks_outreach = true WHERE lower(name) = 'not a fit';
