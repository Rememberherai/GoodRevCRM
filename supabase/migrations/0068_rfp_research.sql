-- RFP Research Results table
-- Stores comprehensive AI-powered research about RFPs

CREATE TABLE rfp_research_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rfp_id UUID NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,

  -- Research status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,

  -- Structured research result sections (JSONB for flexibility)
  organization_profile JSONB,
  industry_context JSONB,
  competitor_analysis JSONB,
  similar_contracts JSONB,
  key_decision_makers JSONB,
  news_and_press JSONB,
  compliance_context JSONB,
  market_intelligence JSONB,

  -- Summary and recommendations
  executive_summary TEXT,
  key_insights JSONB DEFAULT '[]'::jsonb,
  recommended_actions JSONB DEFAULT '[]'::jsonb,

  -- Sources with full citation info
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- AI metadata
  model_used TEXT,
  tokens_used INTEGER,

  -- Audit
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rfp_research_results_project ON rfp_research_results(project_id);
CREATE INDEX idx_rfp_research_results_rfp ON rfp_research_results(rfp_id);
CREATE INDEX idx_rfp_research_results_status ON rfp_research_results(status);
CREATE INDEX idx_rfp_research_results_created ON rfp_research_results(created_at DESC);

-- Enable RLS
ALTER TABLE rfp_research_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view rfp research in their projects"
  ON rfp_research_results FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create rfp research in their projects"
  ON rfp_research_results FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update rfp research in their projects"
  ON rfp_research_results FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

-- Updated at trigger
CREATE TRIGGER set_rfp_research_results_updated_at
  BEFORE UPDATE ON rfp_research_results
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
