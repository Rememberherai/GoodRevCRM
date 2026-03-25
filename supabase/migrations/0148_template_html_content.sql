-- Add html_content column to contract_templates for lightweight waiver rendering.
-- WYSIWYG-created waivers store their original HTML here so the signing page
-- can render the content directly instead of loading a PDF viewer.
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS html_content text;
