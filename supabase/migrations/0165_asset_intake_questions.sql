-- Add asset-level intake questions (custom_questions) to community_assets.
-- These questions appear on ALL booking options for the asset.
-- Preset-level custom_questions (on event_types) are additive.

ALTER TABLE community_assets
  ADD COLUMN IF NOT EXISTS custom_questions JSONB DEFAULT '[]';
