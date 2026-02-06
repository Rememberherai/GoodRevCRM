// RFP Research types

export type RfpResearchStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ResearchSource {
  url: string;
  title: string;
  domain: string;
  snippet?: string;
  published_date?: string;
  section: string;
}

export interface OrganizationProfile {
  overview?: string | null;
  headquarters?: string | null;
  employee_count?: string | null;
  annual_budget?: string | null;
  leadership?: Array<{
    name: string;
    title: string;
    relevance?: string;
  }> | null;
  recent_initiatives?: string[] | null;
  procurement_history?: string | null;
}

export interface IndustryContext {
  market_overview?: string | null;
  trends?: string[] | null;
  market_size?: string | null;
  regulatory_environment?: string | null;
}

export interface Competitor {
  name: string;
  likelihood: 'high' | 'medium' | 'low';
  strengths?: string[];
  recent_wins?: string[];
}

export interface CompetitorAnalysis {
  likely_bidders?: Competitor[] | null;
  competitive_landscape?: string | null;
}

export interface SimilarContract {
  title: string;
  issuer: string;
  value?: string;
  winner?: string;
  date?: string;
  relevance: string;
}

export interface KeyDecisionMaker {
  name: string;
  title: string;
  role_in_decision?: string;
  linkedin_url?: string;
}

export interface NewsItem {
  title: string;
  source: string;
  date?: string;
  summary: string;
  relevance: string;
  url: string;
}

export interface ComplianceContext {
  relevant_regulations?: string[] | null;
  certifications_required?: string[] | null;
  compliance_notes?: string | null;
}

export interface MarketIntelligence {
  pricing_benchmarks?: string | null;
  typical_contract_length?: string | null;
  evaluation_criteria_insights?: string | null;
}

export interface RfpResearchResult {
  id: string;
  project_id: string;
  rfp_id: string;
  status: RfpResearchStatus;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  organization_profile: OrganizationProfile | null;
  industry_context: IndustryContext | null;
  competitor_analysis: CompetitorAnalysis | null;
  similar_contracts: SimilarContract[] | null;
  key_decision_makers: KeyDecisionMaker[] | null;
  news_and_press: NewsItem[] | null;
  compliance_context: ComplianceContext | null;
  market_intelligence: MarketIntelligence | null;
  executive_summary: string | null;
  key_insights: string[];
  recommended_actions: string[];
  sources: ResearchSource[];
  model_used: string | null;
  tokens_used: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RfpResearchContext {
  rfp: {
    id: string;
    title: string;
    description?: string | null;
    rfp_number?: string | null;
    estimated_value?: number | null;
    due_date?: string | null;
    submission_method?: string | null;
  };
  organization?: {
    name: string;
    domain?: string | null;
    industry?: string | null;
    description?: string | null;
  } | null;
  additional_context?: string;
}
