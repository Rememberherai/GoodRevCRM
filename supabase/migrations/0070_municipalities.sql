-- Canadian Municipalities RFP Scanner
-- Tables for tracking municipalities and scan operations

-- Municipalities table
CREATE TABLE IF NOT EXISTS municipalities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  province TEXT NOT NULL,
  country TEXT DEFAULT 'Canada',
  official_website TEXT,
  minutes_url TEXT,
  population INTEGER,
  municipality_type TEXT, -- city/town/village/regional/district
  last_scanned_at TIMESTAMPTZ,
  scan_status TEXT DEFAULT 'pending', -- pending/scanning/success/failed/no_minutes
  scan_error TEXT,
  rfps_found_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_municipalities_province ON municipalities(province);
CREATE INDEX IF NOT EXISTS idx_municipalities_scan_status ON municipalities(scan_status);

-- Updated timestamp trigger
CREATE TRIGGER update_municipalities_updated_at
  BEFORE UPDATE ON municipalities
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Scan logs table for detailed tracking
CREATE TABLE IF NOT EXISTS municipal_scan_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipality_id UUID REFERENCES municipalities(id) ON DELETE CASCADE,
  scan_started_at TIMESTAMPTZ DEFAULT NOW(),
  scan_completed_at TIMESTAMPTZ,
  status TEXT NOT NULL, -- running/success/failed
  minutes_fetched INTEGER DEFAULT 0,
  rfps_detected INTEGER DEFAULT 0,
  rfps_created INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB, -- store additional context (URLs tried, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for scan logs
CREATE INDEX IF NOT EXISTS idx_scan_logs_municipality ON municipal_scan_logs(municipality_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_status ON municipal_scan_logs(status);

-- Row-Level Security
ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipal_scan_logs ENABLE ROW LEVEL SECURITY;

-- Policies (allow all authenticated users to read)
CREATE POLICY municipalities_select ON municipalities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY scan_logs_select ON municipal_scan_logs
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert/update municipalities
CREATE POLICY municipalities_insert ON municipalities
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY municipalities_update ON municipalities
  FOR UPDATE TO authenticated USING (true);

-- Allow authenticated users to insert scan logs
CREATE POLICY scan_logs_insert ON municipal_scan_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY scan_logs_update ON municipal_scan_logs
  FOR UPDATE TO authenticated USING (true);
