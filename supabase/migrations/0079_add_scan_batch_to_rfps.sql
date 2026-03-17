-- Add scan_batch column to RFPs for monthly scan tracking
-- Format: YYYY-MM (e.g., "2026-03")

ALTER TABLE rfps ADD COLUMN IF NOT EXISTS scan_batch TEXT;

-- Index for filtering by scan batch
CREATE INDEX IF NOT EXISTS idx_rfps_scan_batch ON rfps (scan_batch) WHERE scan_batch IS NOT NULL;

-- Backfill existing RFPs with their creation month
UPDATE rfps
SET scan_batch = to_char(created_at, 'YYYY-MM')
WHERE scan_batch IS NULL
  AND custom_fields->>'source' IN ('municipal_minutes', 'municipal_rfp');
