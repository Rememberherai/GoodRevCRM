'use client';

import {
  Building2,
  TrendingUp,
  Users,
  FileText,
  UserCircle,
  Newspaper,
  ShieldCheck,
  DollarSign,
  Lightbulb,
  CheckSquare,
  ExternalLink,
  Link as LinkIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResearchSection } from './research-section';
import type {
  RfpResearchResult,
  ResearchSource,
  Competitor,
  SimilarContract,
  KeyDecisionMaker,
  NewsItem,
} from '@/types/rfp-research';

interface RfpResearchDisplayProps {
  research: RfpResearchResult;
}

function getSourcesForSection(sources: ResearchSource[], section: string): ResearchSource[] {
  return sources.filter((s) => s.section === section);
}

function LikelihoodBadge({ likelihood }: { likelihood: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  };
  return (
    <Badge className={colors[likelihood]} variant="secondary">
      {likelihood}
    </Badge>
  );
}

export function RfpResearchDisplay({ research }: RfpResearchDisplayProps) {
  const {
    executive_summary,
    key_insights,
    recommended_actions,
    organization_profile,
    industry_context,
    competitor_analysis,
    similar_contracts,
    key_decision_makers,
    news_and_press,
    compliance_context,
    market_intelligence,
    sources,
  } = research;

  return (
    <div className="space-y-6">
      {/* Executive Summary - Always visible */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{executive_summary}</p>
        </CardContent>
      </Card>

      {/* Key Insights */}
      {key_insights && key_insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {key_insights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-primary font-bold">{idx + 1}.</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recommended Actions */}
      {recommended_actions && recommended_actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-green-500" />
              Recommended Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recommended_actions.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Organization Profile */}
      <ResearchSection
        title="Organization Profile"
        icon={Building2}
        sources={getSourcesForSection(sources, 'organization_profile')}
        isEmpty={!organization_profile}
      >
        {organization_profile && (
          <div className="space-y-3">
            {organization_profile.overview && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overview</p>
                <p>{organization_profile.overview}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {organization_profile.headquarters && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Headquarters</p>
                  <p>{organization_profile.headquarters}</p>
                </div>
              )}
              {organization_profile.employee_count && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Employees</p>
                  <p>{organization_profile.employee_count}</p>
                </div>
              )}
              {organization_profile.annual_budget && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Annual Budget</p>
                  <p>{organization_profile.annual_budget}</p>
                </div>
              )}
            </div>
            {organization_profile.leadership && organization_profile.leadership.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Key Leadership</p>
                <div className="space-y-2">
                  {organization_profile.leadership.map((leader, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{leader.name}</span>
                      <span className="text-muted-foreground">-</span>
                      <span>{leader.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {organization_profile.recent_initiatives &&
              organization_profile.recent_initiatives.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Recent Initiatives
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {organization_profile.recent_initiatives.map((initiative, idx) => (
                      <li key={idx}>{initiative}</li>
                    ))}
                  </ul>
                </div>
              )}
            {organization_profile.procurement_history && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Procurement History</p>
                <p>{organization_profile.procurement_history}</p>
              </div>
            )}
          </div>
        )}
      </ResearchSection>

      {/* Industry Context */}
      <ResearchSection
        title="Industry Context"
        icon={TrendingUp}
        sources={getSourcesForSection(sources, 'industry_context')}
        isEmpty={!industry_context}
      >
        {industry_context && (
          <div className="space-y-3">
            {industry_context.market_overview && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Market Overview</p>
                <p>{industry_context.market_overview}</p>
              </div>
            )}
            {industry_context.market_size && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Market Size</p>
                <p>{industry_context.market_size}</p>
              </div>
            )}
            {industry_context.trends && industry_context.trends.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Key Trends</p>
                <ul className="list-disc list-inside space-y-1">
                  {industry_context.trends.map((trend, idx) => (
                    <li key={idx}>{trend}</li>
                  ))}
                </ul>
              </div>
            )}
            {industry_context.regulatory_environment && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Regulatory Environment</p>
                <p>{industry_context.regulatory_environment}</p>
              </div>
            )}
          </div>
        )}
      </ResearchSection>

      {/* Competitor Analysis */}
      <ResearchSection
        title="Competitor Analysis"
        icon={Users}
        sources={getSourcesForSection(sources, 'competitor_analysis')}
        isEmpty={!competitor_analysis}
      >
        {competitor_analysis && (
          <div className="space-y-4">
            {competitor_analysis.competitive_landscape && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Competitive Landscape</p>
                <p>{competitor_analysis.competitive_landscape}</p>
              </div>
            )}
            {competitor_analysis.likely_bidders &&
              competitor_analysis.likely_bidders.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Likely Bidders</p>
                  <div className="space-y-3">
                    {competitor_analysis.likely_bidders.map((competitor: Competitor, idx) => (
                      <div key={idx} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{competitor.name}</span>
                          <LikelihoodBadge likelihood={competitor.likelihood} />
                        </div>
                        {competitor.strengths && competitor.strengths.length > 0 && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Strengths: </span>
                            {competitor.strengths.join(', ')}
                          </div>
                        )}
                        {competitor.recent_wins && competitor.recent_wins.length > 0 && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Recent Wins: </span>
                            {competitor.recent_wins.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </ResearchSection>

      {/* Similar Contracts */}
      <ResearchSection
        title="Similar Contracts"
        icon={FileText}
        sources={getSourcesForSection(sources, 'similar_contracts')}
        isEmpty={!similar_contracts || similar_contracts.length === 0}
      >
        {similar_contracts && similar_contracts.length > 0 && (
          <div className="space-y-3">
            {similar_contracts.map((contract: SimilarContract, idx) => (
              <div key={idx} className="border rounded-lg p-3">
                <div className="font-medium">{contract.title}</div>
                <div className="text-sm text-muted-foreground">{contract.issuer}</div>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  {contract.value && <span>Value: {contract.value}</span>}
                  {contract.winner && <span>Winner: {contract.winner}</span>}
                  {contract.date && <span>Date: {contract.date}</span>}
                </div>
                <div className="text-sm mt-2">
                  <span className="text-muted-foreground">Relevance: </span>
                  {contract.relevance}
                </div>
              </div>
            ))}
          </div>
        )}
      </ResearchSection>

      {/* Key Decision Makers */}
      <ResearchSection
        title="Key Decision Makers"
        icon={UserCircle}
        sources={getSourcesForSection(sources, 'key_decision_makers')}
        isEmpty={!key_decision_makers || key_decision_makers.length === 0}
      >
        {key_decision_makers && key_decision_makers.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {key_decision_makers.map((person: KeyDecisionMaker, idx) => (
              <div key={idx} className="border rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <UserCircle className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{person.name}</div>
                    <div className="text-sm text-muted-foreground">{person.title}</div>
                  </div>
                </div>
                {person.role_in_decision && (
                  <div className="text-sm mt-2">
                    <span className="text-muted-foreground">Role: </span>
                    {person.role_in_decision}
                  </div>
                )}
                {person.linkedin_url && (
                  <a
                    href={person.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                  >
                    <LinkIcon className="h-3 w-3" />
                    LinkedIn
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </ResearchSection>

      {/* News & Press */}
      <ResearchSection
        title="News & Press"
        icon={Newspaper}
        sources={getSourcesForSection(sources, 'news_and_press')}
        isEmpty={!news_and_press || news_and_press.length === 0}
      >
        {news_and_press && news_and_press.length > 0 && (
          <div className="space-y-3">
            {news_and_press.map((news: NewsItem, idx) => (
              <a
                key={idx}
                href={news.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block border rounded-lg p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{news.title}</div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <span>{news.source}</span>
                  {news.date && (
                    <>
                      <span>•</span>
                      <span>{news.date}</span>
                    </>
                  )}
                </div>
                <div className="text-sm mt-2">{news.summary}</div>
              </a>
            ))}
          </div>
        )}
      </ResearchSection>

      {/* Compliance Context */}
      <ResearchSection
        title="Compliance Context"
        icon={ShieldCheck}
        sources={getSourcesForSection(sources, 'compliance_context')}
        isEmpty={!compliance_context}
      >
        {compliance_context && (
          <div className="space-y-3">
            {compliance_context.relevant_regulations &&
              compliance_context.relevant_regulations.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Relevant Regulations
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {compliance_context.relevant_regulations.map((reg, idx) => (
                      <Badge key={idx} variant="outline">
                        {reg}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            {compliance_context.certifications_required &&
              compliance_context.certifications_required.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Certifications Required
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {compliance_context.certifications_required.map((cert, idx) => (
                      <Badge key={idx} variant="secondary">
                        {cert}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            {compliance_context.compliance_notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Notes</p>
                <p>{compliance_context.compliance_notes}</p>
              </div>
            )}
          </div>
        )}
      </ResearchSection>

      {/* Market Intelligence */}
      <ResearchSection
        title="Market Intelligence"
        icon={DollarSign}
        sources={getSourcesForSection(sources, 'market_intelligence')}
        isEmpty={!market_intelligence}
      >
        {market_intelligence && (
          <div className="space-y-3">
            {market_intelligence.pricing_benchmarks && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pricing Benchmarks</p>
                <p>{market_intelligence.pricing_benchmarks}</p>
              </div>
            )}
            {market_intelligence.typical_contract_length && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Typical Contract Length
                </p>
                <p>{market_intelligence.typical_contract_length}</p>
              </div>
            )}
            {market_intelligence.evaluation_criteria_insights && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Evaluation Criteria Insights
                </p>
                <p>{market_intelligence.evaluation_criteria_insights}</p>
              </div>
            )}
          </div>
        )}
      </ResearchSection>

      {/* All Sources */}
      {sources && sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              All Sources ({sources.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sources.map((source, idx) => (
                <a
                  key={idx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-primary">{source.title}</span>
                  <span className="text-muted-foreground">({source.domain})</span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
