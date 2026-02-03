-- Add organization_id to sequences for organization-specific sequences
ALTER TABLE sequences
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Index for filtering sequences by organization
CREATE INDEX IF NOT EXISTS idx_sequences_organization ON sequences(organization_id)
WHERE organization_id IS NOT NULL;

-- Add a comment explaining the feature
COMMENT ON COLUMN sequences.organization_id IS 'Optional: links sequence to a specific organization. When set, the sequence is organization-specific and will use org context for variable substitution.';
