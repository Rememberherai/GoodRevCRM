-- Add body_html column for storing rich HTML content from the WYSIWYG editor.
-- The existing body column continues to hold plain text (used for SMS / fallback).
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS body_html TEXT;
