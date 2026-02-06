import { z } from 'zod';

// Schema for starting RFP research
export const startRfpResearchSchema = z.object({
  additional_context: z.string().max(2000).optional(),
});

export type StartRfpResearchInput = z.infer<typeof startRfpResearchSchema>;

// Schemas for AI structured output
const sourceSchema = z.object({
  url: z.string(),
  title: z.string(),
  domain: z.string(),
  snippet: z.string().nullish(),
  published_date: z.string().nullish(),
  section: z.string(),
});

const organizationProfileSchema = z.object({
  overview: z.string().nullish(),
  headquarters: z.string().nullish(),
  employee_count: z.string().nullish(),
  annual_budget: z.string().nullish(),
  leadership: z
    .array(
      z.object({
        name: z.string(),
        title: z.string(),
        relevance: z.string().nullish(),
      })
    )
    .nullish(),
  recent_initiatives: z.array(z.string()).nullish(),
  procurement_history: z.string().nullish(),
});

const industryContextSchema = z.object({
  market_overview: z.string().nullish(),
  trends: z.array(z.string()).nullish(),
  market_size: z.string().nullish(),
  regulatory_environment: z.string().nullish(),
});

const competitorSchema = z.object({
  name: z.string(),
  likelihood: z.enum(['high', 'medium', 'low']),
  strengths: z.array(z.string()).nullish(),
  recent_wins: z.array(z.string()).nullish(),
});

const competitorAnalysisSchema = z.object({
  likely_bidders: z.array(competitorSchema).nullish(),
  competitive_landscape: z.string().nullish(),
});

const similarContractSchema = z.object({
  title: z.string(),
  issuer: z.string(),
  value: z.string().nullish(),
  winner: z.string().nullish(),
  date: z.string().nullish(),
  relevance: z.string(),
});

const keyDecisionMakerSchema = z.object({
  name: z.string().nullish(),
  title: z.string(),
  role_in_decision: z.string().nullish(),
  linkedin_url: z.string().nullish(),
});

const newsItemSchema = z.object({
  title: z.string(),
  source: z.string(),
  date: z.string().nullish(),
  summary: z.string(),
  relevance: z.string(),
  url: z.string(),
});

const complianceContextSchema = z.object({
  relevant_regulations: z.array(z.string()).nullish(),
  certifications_required: z.array(z.string()).nullish(),
  compliance_notes: z.string().nullish(),
});

const marketIntelligenceSchema = z.object({
  pricing_benchmarks: z.string().nullish(),
  typical_contract_length: z.string().nullish(),
  evaluation_criteria_insights: z.string().nullish(),
});

// Main research result schema for AI output
export const rfpResearchResultSchema = z.object({
  organization_profile: organizationProfileSchema.nullish(),
  industry_context: industryContextSchema.nullish(),
  competitor_analysis: competitorAnalysisSchema.nullish(),
  similar_contracts: z.array(similarContractSchema).nullish(),
  key_decision_makers: z.array(keyDecisionMakerSchema).nullish(),
  news_and_press: z.array(newsItemSchema).nullish(),
  compliance_context: complianceContextSchema.nullish(),
  market_intelligence: marketIntelligenceSchema.nullish(),
  executive_summary: z.string(),
  key_insights: z.array(z.string()),
  recommended_actions: z.array(z.string()),
  sources: z.array(sourceSchema),
});

export type RfpResearchAIResult = z.infer<typeof rfpResearchResultSchema>;
